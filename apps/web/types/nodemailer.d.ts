declare module 'nodemailer' {
	interface TransportOptions {
		host?: string;
		port?: number;
		secure?: boolean;
		auth?: {
			user: string;
			pass: string;
		};
	}

	interface Transporter {
		sendMail(options: MailOptions): Promise<any>;
	}

	interface MailOptions {
		from: string;
		to: string | string[];
		subject: string;
		text?: string;
		html?: string;
	}

	function createTransport(options: TransportOptions): Transporter;

	const nodemailer: {
		createTransport: typeof createTransport;
	};

	export default nodemailer;
	export { createTransport, TransportOptions, Transporter, MailOptions };
}
