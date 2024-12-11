const sgMail = require("@sendgrid/mail");
const axios = require("axios");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method Not Allowed" }),
    };
  }

  try {
    // Parse the JSON body directly (frontend sends JSON)
    const body = JSON.parse(event.body);

    const {
      name,
      email,
      phone,
      vin,
      message,
      website,
      formTimestamp,
      "g-recaptcha-response": recaptchaResponse,
    } = body;

    console.log("Parsed Fields:", { name, email, phone, vin, message, website, formTimestamp, recaptchaResponse });

    // Validate required fields
    if (!formTimestamp || !recaptchaResponse) {
      console.warn("Missing required fields");
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "All fields are required" }),
      };
    }

    // Time-based validation
    const now = Date.now();
    if (now - parseInt(formTimestamp, 10) < 3000) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Form submitted too quickly" }),
      };
    }

    // Honeypot check
    if (website) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Spam detected" }),
      };
    }

    // Verify reCAPTCHA
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
    const recaptchaResponseData = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      {},
      {
        params: {
          secret: recaptchaSecret,
          response: recaptchaResponse,
        },
      }
    );

    if (!recaptchaResponseData.data.success) {
      console.warn("reCAPTCHA validation failed:", recaptchaResponseData.data);
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "reCAPTCHA validation failed" }),
      };
    }

    // Send email
    const msg = {
      to: "maceautomotive@gmail.com",
      from: "maceautomotive@gmail.com",
      subject: "Contact Form Submission",
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nVIN: ${vin || "N/A"}\nMessage: ${message}`,
    };

    await sgMail.send(msg);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Email sent successfully" }),
    };
  } catch (error) {
    console.error("Error processing form submission:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
