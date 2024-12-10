require('dotenv').config();
const sgMail = require('@sendgrid/mail');
const axios = require('axios');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' }),
        };
    }

    try {
        const { name, email, phone, vin, message, website, formTimestamp, "g-recaptcha-response": recaptchaResponse } = JSON.parse(event.body);

        console.log("Parsed Fields:", { name, email, phone, vin, message, website, formTimestamp, recaptchaResponse });

        // Honeypot check
        if (website) {
            console.warn('Honeypot triggered!');
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Spam detected!' }),
            };
        }

        // Time-based validation
        const now = Date.now();
        const submissionTime = parseInt(formTimestamp, 10);

        if (now - submissionTime < 3000) { // Adjust threshold (3 seconds) as needed
            console.warn('Form submitted too quickly.');
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Form submitted too quickly. Please try again.' }),
            };
        }

        // Validate required fields
        if (!name || !email || !phone || !message || !recaptchaResponse) {
            console.warn('Missing fields:', { name, email, phone, message, recaptchaResponse });
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'All fields are required' }),
            };
        }

        // reCAPTCHA Validation
        const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
        const recaptchaVerifyResponse = await axios.post(
            `https://www.google.com/recaptcha/api/siteverify`,
            {},
            {
                params: {
                    secret: recaptchaSecret,
                    response: recaptchaResponse,
                },
            }
        );

        console.log('reCAPTCHA response:', recaptchaVerifyResponse.data);

        if (!recaptchaVerifyResponse.data.success) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'reCAPTCHA validation failed' }),
            };
        }

        // Send email
        const msg = {
            to: 'maceautomotive@gmail.com',
            from: 'maceautomotive@gmail.com',
            subject: 'Contact Form Submission',
            text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nVIN: ${vin || 'N/A'}\nMessage: ${message}`,
        };

        await sgMail.send(msg);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Email sent successfully' }),
        };
    } catch (error) {
        console.error('Error in contact function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to send email' }),
        };
    }
};
