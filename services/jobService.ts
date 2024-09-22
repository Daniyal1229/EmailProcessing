import { Queue, Worker } from 'bullmq';
import OpenAI from 'openai';
import IORedis from 'ioredis';
import { getOutlookEmails, InitializeClient } from './outlookService';
import { generateOAuthClient } from '../utils/oauth';
import { google, gmail_v1 } from 'googleapis';
import { getGmailEmails } from './gmailService';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY || '',
	dangerouslyAllowBrowser: true,
});

export const redisConnection = new IORedis({
	host: '127.0.0.1',
	port: 6379,
	maxRetriesPerRequest: null,
});

export const emailQueue = new Queue('emailQueue', {
	connection: redisConnection,
});

export const processQueue = new Queue('processQueue', {
	connection: redisConnection,
});

const emailWorker = new Worker(
	'emailQueue',
	async (job) => {
		const { email, accessToken } = job.data;
		const response: GPTResponse = await categorizeEmailAndGenerateReply(email);
		sendReply(email, response.label, accessToken);
	},
	{
		connection: redisConnection,
	}
);const fetchEmails = new Worker(
	'processQueue',
	async (job) => {
		console.log('Starting email processing job');
		const { method, accessToken } = job.data;
		if (method == 'GMAIL') {
			console.log('Processing Gmail emails');
			try {
				const emails = await getGmailEmails(accessToken);
				console.log(`Fetched ${emails.length} Gmail emails`);

				const oAuth2Client = await generateOAuthClient({
					clientId: process.env.GMAIL_CLIENT_ID || '',
					clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
					redirectUri: process.env.GMAIL_REDIRECT_URI || '',
				});
				oAuth2Client.setCredentials(accessToken);
				const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

				for (const email of emails) {
					console.log(`Processing email ID: ${email.id}`);
					const { headers } = email.payload;
					const subject = headers.find((header: any) => header.name === 'Subject')?.value || 'No Subject';
					const from = headers.find((header: any) => header.name === 'From')?.value || 'Unknown Sender';
					const to = headers.find((header: any) => header.name === 'To')?.value || 'Unknown Recipient';
					const date = headers.find((header: any) => header.name === 'Date')?.value || 'Unknown Date';
					console.log(`
						Email ID: ${email.id}
						From: ${from}
						To: ${to}
						Subject: ${subject}
						Date: ${date}
						Snippet: ${email.snippet}
					`);

					console.log('Starting email classification');
					const classification = await classifyEmail(email.snippet);
					console.log(`Email classified as: ${classification}`);

					console.log('Creating/applying label');
					await createAndApplyLabel(gmail, email.id, classification);

					if (classification !== 'Not Interested') {
						console.log('Sending reply');
						await sendReply(gmail, email.id, classification);
					}

					console.log(`Finished processing email ID: ${email.id}`);
				}
			} catch (error) {
				console.error('Error processing Gmail emails:', error);
			}
		}
		if (method == 'OUTLOOK') {
			const emails = await getOutlookEmails(accessToken);
			console.log('No of Outlook Emails Processed', emails.length);
			emails.forEach((email) => {
				if (!email.isRead) {
					const data = {
						subject: email.subject,
						body: email.bodyPreview,
						senderEmail: email.sender.emailAddress.address,
						receivingEmail: email.toRecipients[0].emailAddress.address,
						connection: method,
					};
					emailQueue.add('processEmail', {
						email: data,
						accessToken: accessToken,
						id: email.id,
					});
				}
			});
		}
	},
	{
		connection: redisConnection,
	}
);

async function categorizeEmailAndGenerateReply(email: Email): Promise<GPTResponse> {
	const response = await openai.chat.completions.create({
		messages: [
			{
				role: 'system',
				content: `You are building an AI tool to categorize and respond to emails automatically. The tool should categorize incoming emails into one of the following categories: "Interested", "Not Interested", or "More Information".
				
				If an email indicates interest in the product or service and requests further details such as pricing or a demo, categorize it as "Interested". If the email explicitly states disinterest or mentions that the product is not relevant, categorize it as "Not Interested". If the email expresses interest but seeks additional information like a free trial or demonstration, categorize it as "More Information".
				
				Your task is to develop the logic for categorizing incoming emails and generating suitable replies based on their categorization.
				
				Please provide your response in the following JSON format:

				{
					"label": "",
					"reply": {
						"subject": "",
						"body": ""
					}
				}

				For example:
				If the email content indicates interest and requests a demo, the tool should generate a reply asking the sender if they are willing to schedule a demo call.

				Your response:
				{
					"label": "Interested",
					"reply": {
						"subject": "Schedule a Demo Call",
						"body": "Hello! Thank you for reaching out. We're glad to hear you're interested in our product. Could you please let us know your availability for a demo call?"
					}
				}

				The actual email content: \n
				${email}`
			},
		],
		model: 'gpt-3.5-turbo',
	});
	const data = response.choices[0].message.content;
	let obj;
	if (data) {
		obj = JSON.parse(data);
	}
	obj.email = email;
	return obj;
}

async function sendReply(gmail: gmail_v1.Gmail, emailId: string, classification: string) {
	try {
		const email = await gmail.users.messages.get({ userId: 'me', id: emailId });
		const headers = email.data.payload?.headers;
		const subject = headers?.find(h => h.name === 'Subject')?.value || '';
		const from = headers?.find(h => h.name === 'From')?.value || '';

		const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
		const replyBody = generateReplyBody(classification);

		const message = [
			`From: me`,
			`To: ${from}`,
			`Subject: ${replySubject}`,
			`In-Reply-To: ${emailId}`,
			`References: ${emailId}`,
			'',
			replyBody
		].join('\n');

		const encodedMessage = Buffer.from(message)
			.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');

		await gmail.users.messages.send({
			userId: 'me',
			requestBody: { raw: encodedMessage }
		});
	} catch (error) {
		console.error('Error sending reply:', error);
	}
}

function generateReplyBody(classification: string): string {
	switch (classification) {
		case 'Interested':
			return 'Thank you for your interest. We would be happy to provide more information about our products/services.';
		case 'More Information':
			return `We appreciate your inquiry. We'd be glad to provide additional information. What specific details are you looking for?`;
		default:
			return 'Thank you for your email. We have received your message and will get back to you if necessary.';
	}
}

async function classifyEmail(snippet: string): Promise<string> {
	const response = await openai.chat.completions.create({
		messages: [
			{
				role: 'system',
				content: `Classify the following email snippet as "Interested", "Not Interested", or "More Information":\n\n${snippet}`
			}
		],
		model: 'gpt-3.5-turbo',
	});
	return response.choices[0].message.content || 'Unclassified';
}

async function createAndApplyLabel(gmail: gmail_v1.Gmail, emailId: string, classification: string) {
	try {
		const labelData = await gmail.users.labels.list({ userId: 'me' });
		let label = labelData.data.labels?.find(l => l.name === classification);

		if (!label) {
			const newLabel = await gmail.users.labels.create({
				userId: 'me',
				requestBody: { name: classification }
			});
			label = newLabel.data;
		}

		if (label && label.id) {
			await gmail.users.messages.modify({
				userId: 'me',
				id: emailId,
				requestBody: {
					addLabelIds: [label.id],
					removeLabelIds: ['INBOX', 'UNREAD']
				}
			});
		}
	} catch (error) {
		console.error('Error creating/applying label:', error);
	}
}

interface Email {
	subject: string;
	body: string;
	senderEmail: string;
	receivingEmail: string;
	connection: 'OUTLOOK' | 'GMAIL';
}

interface GPTResponse {
	label: string;
	reply: {
		subject: string;
		body: string;
	};
	email: Email;
}

interface EmailAddress {
	address: string;
}

interface ToRecipient {
	emailAddress: EmailAddress;
}

interface EmailMessage {
	subject: string;
	body: {
		contentType: string;
		content: string;
	};
	toRecipients: ToRecipient[];
}

interface SendingBody {
	message: EmailMessage;
	saveToSentItems: string;
}