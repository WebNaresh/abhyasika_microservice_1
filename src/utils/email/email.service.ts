import { Injectable } from '@nestjs/common';
import { Transporter, createTransport } from 'nodemailer';
import { ConfirmationTemplateEmailDto } from './dto/create-email.dto';

interface Data {
  to: string;
  user_name: string;
  library_name: string;
  user_plan_name: string;
  user_plan_price: string;
  user_plan_features: string[];
  receipt_id: string;
  start_date: string;
  library_email: string;
  library_url: string;
  library_logo: string;
  end_date: string;
  room_description: string;
  library_description: string;
  seat: string;
}
interface InterestedData {
  to: string,
  user_name: string,
  library_name: string,
  room_name: string,
  library_logo: string,
  seat: string,
  library_owner: string,
}
interface MembershipCancellationData {
  to: string,
  user_name: string,
  library_name: string,
  library_contact_no: string,
  library_logo: string,
  library_email: string,
}
@Injectable()
export class EmailService {
  private transporter: Transporter;

  constructor() {
    // Initialize the email transporter only once
    this.transporter = createTransport({
      host: process.env.HOST, // Replace with your SMTP server
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.Mail_ID, // Replace with your SMTP username
        pass: process.env.PASSWORD, // Replace with your SMTP password
      },
    });
  }

  async sendOtp(to: string, otp: number) {
    const htmlContent = `
   <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify your login</title>
    <!--[if mso
      ]><style type="text/css">
        body,
        table,
        td,
        a {
          font-family: Arial, Helvetica, sans-serif !important;
        }
      </style><!
    [endif]-->
    <style>
      .copy-button {
        background-color: #4caf50;
        color: white;
        border: none;
        padding: 10px 20px;
        text-align: center;
        text-decoration: none;
        display: inline-block;
        font-size: 16px;
        margin: 4px 2px;
        cursor: pointer;
        border-radius: 5px;
        width: max-content;
      }
    </style>
  </head>
  <body
    style="
      font-family: Helvetica, Arial, sans-serif;
      margin: 0px;
      padding: 0px;
      background-color: #ffffff;
    "
  >
    <table
      role="presentation"
      style="
        width: 100%;
        border-collapse: collapse;
        border: 0px;
        border-spacing: 0px;
        font-family: Arial, Helvetica, sans-serif;
        background-color: rgb(239, 239, 239);
      "
    >
      <tbody>
        <tr>
          <td
            align="center"
            style="padding: 1rem 2rem; vertical-align: top; width: 100%"
          >
            <table
              role="presentation"
              style="
                max-width: 600px;
                border-collapse: collapse;
                border: 0px;
                border-spacing: 0px;
                text-align: left;
              "
            >
              <tbody>
                <tr>
                  <td style="padding: 40px 0px 0px">
                    <div style="text-align: left">
                      <div style="padding-bottom: 20px; display: flex">
                        <div
                          style="
                            background-color: #ffffff;
                            padding: 10px;
                            border-radius: 100%;
                            width: 36px;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                          "
                        >
                          <img
                            src="https://neststudyroom.s3.ap-south-1.amazonaws.com/main_logo.png"
                            alt="Company"
                            style="width: auto; height: 36px; margin: auto"
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      style="
                        padding: 20px;
                        background-color: rgb(255, 255, 255);
                        border-radius: 10px;
                      "
                    >
                      <div style="color: rgb(0, 0, 0); text-align: left">
                        <h1 style="margin: 1rem 0">Verification code</h1>
                        <p style="padding-bottom: 16px">
                          Please use the verification code below to sign in.
                        </p>
                        <p
                          style="
                            padding-bottom: 16px;
                            font-size: 130%;
                            font-weight: bold;
                            background-color: #f0f0f0;
                            padding: 10px;
                            text-align: center;
                            border-radius: 5px;
                          "
                          id="otp-code"
                        >
                          ${otp}
                        </p>

                        <p style="padding-bottom: 16px">
                          If you didn’t request this, you can ignore this email.
                        </p>
                        <p style="padding-bottom: 16px">
                          Thanks,<br />The My Abhyasika team
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>

    <script>
      async function copyToClipboard() {
        const otpCode = document.getElementById('otp-code').innerText;
        await navigator.clipboard.writeText(otpCode);
      }
    </script>
  </body>
</html>


    `;

    const mailOptions = {
      from: `'My Abhyasika' <${process.env.Mail_ID}>`, // Replace with your sender address
      to, // Recipient email address
      subject: 'Your OTP Code', // Subject of the email
      html: htmlContent, // The HTML content using the template
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('OTP email sent: %s', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending OTP email:', error);
      throw error;
    }
  }

  async send_enrollment_email({
    to,
    user_name,
    library_name,
    user_plan_name,
    user_plan_price,
    user_plan_features,
    receipt_id,
    start_date,
    end_date,
    library_email,
    library_url,
    library_description,
    room_description,
    library_logo,
    seat,
  }: Data) {
    // Format the dates properly
    const formattedStartDate = new Date(start_date).toLocaleDateString('en-IN');
    const formattedEndDate = new Date(end_date).toLocaleDateString('en-IN');

    // Assuming next payment date is the end date
    const next_payment_date = end_date;

    // Create the HTML content including all the necessary details
    const htmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome My-अभ्यासिका</title>
  </head>
  <body
    style="
      margin: 0;
      padding: 0;
      background-color: #f4f4f7;
      font-family: Arial, sans-serif;
      color: #333333;
      line-height: 1.6;
    "
  >
    <div
      style="
        max-width: 600px;
        margin: 20px auto;
        background-color: #ffffff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      "
    >
      <div style="text-align: center; margin-bottom: 20px">
        <img
          src="${library_logo}
          alt="Library Logo"
          style="width: 100px; height: 100px; margin-bottom: 10px"
        />
        <h1 style="font-size: 24px; color: #333333; margin: 0">
          Welcome, ${user_name}!
        </h1>
      </div>

      <p style="margin-bottom: 20px">
        Thank you for joining ${library_name}. We are excited to have you
        as a part of our community!
      </p>

      <div style="margin-bottom: 20px">
        <h2 style="font-size: 18px; color: #333333; margin-bottom: 10px">
          Login to Your Account:
        </h2>
        <p>
          Use your registered email and OTP to log in to the library website:
          <a
            href="https://${library_url}.abhyasika.online"
            style="color: #4caf50; text-decoration: none"
          >
            ${library_url}.abhyasika.online
          </a>
        </p>
      </div>
      <div style="margin-bottom: 20px">
        <h2 style="font-size: 18px; color: #333333; margin-bottom: 10px">
          Your Plan Details:
        </h2>
        <table style="width: 100%; border-collapse: collapse">
          <thead>
            <tr style="background-color: #f2f2f2">
              <th
                style="
                  padding: 10px;
                  text-align: left;
                  border-bottom: 1px solid #dddddd;
                "
              >
                Description
              </th>
              <th
                style="
                  padding: 10px;
                  text-align: left;
                  border-bottom: 1px solid #dddddd;
                "
              >
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
               ${user_plan_name}
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                ₹${user_plan_price}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                Plan Start Date
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                ${formattedStartDate}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                Next Payment Date
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                ${formattedEndDate}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                Seat Number
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                ${seat}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                Room Details
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                ${room_description}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold">Total</td>
              <td style="padding: 10px; font-weight: bold">₹${user_plan_price}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p style="margin-bottom: 20px">
        <strong>Receipt ID:</strong> ${receipt_id}
      </p>

      <a
        href="https://www.google.com/calendar/render?action=TEMPLATE&text=Next%20Payment%20Due%20for%20City%20Central%20Library&dates=${formattedEndDate}T000000Z/${formattedEndDate}T010000Z&details=Please%20ensure%20your%20payment%20is%20made%20for%20the%20next%20month%27s%20plan:%20₹${user_plan_price}&location=https://${library_url}.abhyasika.online"
        style="
          display: inline-block;
          width: 100%;
          text-align: center;
          background-color: #4caf50;
          color: white;
          padding: 12px 0;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          margin-bottom: 20px;
        "
      >
        👉 Click to Add Reminder for Next Payment Date to Google Calendar
      </a>

      <p style="margin-bottom: 20px">
        If you have any questions, feel free to reply to this email or contact
        us at
        <a
          href="mailto:${library_email}"
          style="color: #4caf50; text-decoration: none"
        >
         ${library_email} </a
        >.
      </p>

      <p style="margin-bottom: 20px">
        We look forward to seeing you excel with us. Welcome aboard!
      </p>

      <div>
        <p style="margin-bottom: 5px">Best Regards,</p>
        <p style="margin-bottom: 20px">
          The ${library_name} Team
        </p>
      </div>

      <div
        style="
          margin-top: 20px;
          text-align: center;
          font-size: 12px;
          color: #777777;
        "
      >
        &copy; 2023 ${library_name}. All Rights Reserved.
      </div>
    </div>
  </body>
</html>`;

    const mailOptions = {
      from: `'My Abhyasika' <${process.env.Mail_ID}>`,
      to,
      subject: `Welcome to ${library_name}`,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Welcome email sent: %s', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }
  }

  async send_interested_notification({
    to,
    user_name,
    library_name,
    room_name,
    library_logo,
    seat,
    library_owner
  }: InterestedData) {
    // Format the dates properly

    // Create the HTML content including all the necessary details
    const htmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${library_name} - Notification</title>
  </head>
  <body
    style="
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
    "
  >
    <div
      style="
        max-width: 800px;
        margin: 20px auto;
        background-color: #ffffff;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        padding: 20px;
      "
    >
      <div style="display: flex; align-items: center; margin-bottom: 20px">
        <img
          src="${library_logo}"
          alt="${library_name} Logo"
          style="width: 80px; height: 80px; margin-right: 20px"
        />
        <h1 style="color: #6366f1; font-size: 28px; margin: 0">
          ${library_name} Pune
        </h1>
      </div>

      <h2 style="font-size: 24px; margin-bottom: 20px">Hi ${library_owner},</h2>

      <p style="color: #333; margin-bottom: 15px">
        We just want to know that Mr. ${user_name} show interest to join your
        library for ${seat === "N/A" ? `the unreserved seat` : `the reserved seat for the desk no ${seat}`}  ${room_name === "N/A" ? "" : `for the ${room_name}`} to your library
      </p>

      <p style="color: #333; margin-bottom: 15px">
        You can check on the
        <a
          href="https://abhyasika.online/"
          style="color: #6366f1; text-decoration: none"
          >https://abhyasika.online/</a
        >
        about the status you can also add the user else remove
      </p>

      <div
        style="
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #e5e7eb;
          padding-top: 15px;
          margin-top: 20px;
        "
      >
        <span style="font-weight: bold">Time of Interest</span>
        <span style="color: #666">${Date.now().toLocaleString()}</span>
      </div>

      <p style="color: #333; margin-top: 20px">
        If you have any questions or need further assistance, feel free to reply
        to this email or contact our
        <a
          href="mailto:nirmantechsoln@gmail.com"
          style="color: #6366f1; text-decoration: none"
          >nirmantechsoln@gmail.com</a
        >.
      </p>

      <p style="font-weight: bold; font-size: 18px; margin-top: 30px">
        Welcome aboard! We look forward to supporting you on your learning
        journey
      </p>

      <div style="margin-top: 30px">
        <p style="font-weight: bold; margin-bottom: 5px">Best Regards,</p>
        <p style="color: #333">My Abhyasika Team</p>
      </div>
    </div>
  </body>
</html>
`

    const mailOptions = {
      from: `'My Abhyasika' <${process.env.Mail_ID}>`,
      to,
      subject: `Interest Notification from ${user_name}`,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Interest notification email sent: %s', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending interest notification email:', error);
      throw error;
    }

  }

  async send_cancel_membership_email({
    to,
    user_name,
    library_name,
    library_contact_no,
    library_logo,
    library_email,
  }: MembershipCancellationData) {
    // Format the dates properly

    // Create the HTML content including all the necessary details
    const htmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Membership Cancellation Notification</title>
  </head>
  <body
    style="
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 20px;
    "
  >
    <div
      style="
        max-width: 800px;
        margin: 0 auto;
        background-color: #fff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      "
    >
      <header style="display: flex; align-items: center; margin-bottom: 20px">
        <img
          src="${library_logo}"
          alt="${library_logo} Logo"
          style="width: 60px; height: 60px; margin-right: 15px"
        />
        <h1 style="color: #4c4cff; font-size: 24px; margin: 0">
          ${library_name}
        </h1>
      </header>

      <main>
        <h2 style="font-size: 22px; margin-bottom: 20px">Hi ${user_name},</h2>

        <p style="font-size: 18px; font-weight: bold; margin-bottom: 15px">
          Subject:
          <span style="text-decoration: underline"
            >Membership Cancellation Notification</span
          >
        </p>

        <p style="margin-bottom: 15px">
          We regret to inform you that your membership at ${library_name} has been canceled.
        </p>

        <p style="font-weight: bold; margin-bottom: 10px">
          Please note the following important information:
        </p>
        <ul style="margin-bottom: 15px; padding-left: 20px">
          <li>
            You have 5 days to collect your books and belongings from the ${library_name}.
          </li>
          <li>
            After 5 days, ${library_name} will not be responsible for
            any unclaimed items.
          </li>
        </ul>

        <p style="margin-bottom: 15px">
          If you have any questions or need clarification, please don't hesitate
          to contact ${library_name} at the following contact number:
        </p>

        <p style="font-weight: bold; margin-bottom: 15px">
          Library Contact No : ${library_contact_no}
        </p>

        <p style="margin-bottom: 15px">
          If you have any questions or need further assistance, feel free to
          reply to this email or contact library email
          <a
            href="mailto:${library_email}"
            style="color: #0066cc; text-decoration: none"
            >${library_email}</a
          >.
        </p>

        <p style="margin-bottom: 20px">
          Congratulations on your journey so far, and we wish you all the best in
          your future endeavors.
        </p>

        <p style="margin-bottom: 5px">Best Regards,</p>
        <p style="font-weight: bold">${library_name} Team</p>
      </main>
    </div>
  </body>
</html>
`

    const mailOptions = {
      from: `'My Abhyasika' <${process.env.Mail_ID}>`,
      to,
      subject: `Membership Cancellation Notification`,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Membership cancellation email sent: %s', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending membership cancellation email:', error);
      throw error;
    }
  }

  async continue_membership_email({
    to,
    user_name,
    library_name,
    user_plan_name,
    user_plan_price,
    user_plan_features,
    receipt_id,
    start_date,
    end_date,
    library_email,
    library_url,
    library_description,
    room_description,
    library_logo,
    seat,
  }: Data) {
    // Format the dates properly
    const formattedStartDate = new Date(start_date).toLocaleDateString('en-IN');
    const formattedEndDate = new Date(end_date).toLocaleDateString('en-IN');

    // Assuming next payment date is the end date
    const next_payment_date = end_date;

    // Create the HTML content including all the necessary details
    const htmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Continuing Membership - My-अभ्यासिका</title>
  </head>
  <body
    style="
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f4f4f7;
      margin: 0;
      padding: 20px;
    "
  >
    <div
      style="
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      "
    >
      <div style="text-align: center; margin-bottom: 20px">
        <img
          src="${library_logo}"
          alt="Library Logo"
          style="width: 100px; height: 100px; margin-bottom: 10px"
        />
        <h1 style="font-size: 24px; color: #333333; margin: 0">
          Welcome back, ${user_name}!
        </h1>
      </div>

      <p style="margin-bottom: 20px">
        Thank you for continuing your membership with ${library_name}. We're
        delighted to have you with us!
      </p>

      <div style="margin-bottom: 20px">
        <h2 style="font-size: 18px; color: #333333; margin-bottom: 10px">
          Access Your Account:
        </h2>
        <p>
          Use your registered email and OTP to log in to the library website:
          <a
            href="https://${library_url}.abhyasika.online"
            style="color: #4caf50; text-decoration: none"
            >${library_url}.abhyasika.online</a
          >
        </p>
      </div>

      <div style="margin-bottom: 20px">
        <h2 style="font-size: 18px; color: #333333; margin-bottom: 10px">
          Your Updated Plan Details:
        </h2>
        <table style="width: 100%; border-collapse: collapse">
          <thead>
            <tr style="background-color: #f2f2f2">
              <th
                style="
                  padding: 10px;
                  text-align: left;
                  border-bottom: 1px solid #dddddd;
                "
              >
                Description
              </th>
              <th
                style="
                  padding: 10px;
                  text-align: left;
                  border-bottom: 1px solid #dddddd;
                "
              >
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                ${user_plan_name}
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                ₹ ${user_plan_price}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                Plan Start Date
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                ${formattedStartDate}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                Next Payment Date
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                ${formattedEndDate}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                Seat Number
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                ${seat}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                Room Details
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #dddddd">
                ${room_description}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold">Total</td>
              <td style="padding: 10px; font-weight: bold">
                ₹ ${user_plan_price}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p style="margin-bottom: 20px">
        <strong>Receipt ID:</strong> ${receipt_id}
      </p>

      <a
        href="https://www.google.com/calendar/render?action=TEMPLATE&text=Next%20Payment%20Due%20for%20My-अभ्यासिका&dates=${formattedEndDate}T000000Z/${formattedEndDate}T010000Z&details=Please%20ensure%20your%20payment%20is%20made%20for%20the%20next%20month%27s%20plan:%20₹${user_plan_price}&location=https://${library_url}.abhyasika.online"
        style="
          display: block;
          width: 100%;
          text-align: center;
          background-color: #4caf50;
          color: white;
          padding: 12px 0;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          margin-bottom: 20px;
        "
      >
        👉 Click to Add Reminder for Next Payment Date to Google Calendar
      </a>

      <p style="margin-bottom: 20px">
        If you have any questions or need to make changes to your membership,
        please don't hesitate to contact us at
        <a
          href="mailto:${library_email}"
          style="color: #4caf50; text-decoration: none"
          >${library_email}</a
        >.
      </p>

      <p style="margin-bottom: 20px">
        We appreciate your continued support and look forward to providing you
        with excellent service!
      </p>

      <div>
        <p style="margin-bottom: 5px">Best Regards,</p>
        <p style="margin-bottom: 20px">The My-अभ्यासिका Team</p>
      </div>

      <div
        style="
          margin-top: 20px;
          text-align: center;
          font-size: 12px;
          color: #777777;
        "
      >
        &copy; 2023 My-अभ्यासिका. All Rights Reserved.
      </div>
    </div>
  </body>
</html>
`;

    const mailOptions = {
      from: `'My Abhyasika' <${process.env.Mail_ID}>`,
      to,
      subject: `Continuing Membership at ${library_name}`,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Continuing membership email sent: %s', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending continuing membership email:', error);
      throw error;
    }
  }

  async send_library_owner_notification({
    ownerEmail,
    user_name,
    library_name,
    user_plan_name,
    user_plan_price,
    start_date,
    library_id,
  }: {
    ownerEmail: string;
    user_name: string;
    library_name: string;
    user_plan_name: string;
    user_plan_price: string;
    start_date: string;
    library_id: string;
  }) {
    console.log(
      `🚀 ~ file: email.service.ts:532 ~ EmailService ~ {
    ownerEmail,
    user_name,
    library_name,
    user_plan_name,
    user_plan_price,
    start_date,
    library_id,
  }:`,
      {
        ownerEmail,
        user_name,
        library_name,
        user_plan_name,
        user_plan_price,
        start_date,
        library_id,
      },
    );
    // Reconstructing HTML content for the library owner notification
    const htmlContent = `
   <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>User Enrollment Notification</title>
    <style>
      .button {
        background-color: #4caf50;
        color: white;
        border: none;
        padding: 10px 20px;
        text-align: center;
        text-decoration: none;
        display: inline-block;
        font-size: 16px;
        margin: 4px 2px;
        cursor: pointer;
        border-radius: 5px;
      }
    </style>
  </head>
  <body
    style="
      font-family: Helvetica, Arial, sans-serif;
      margin: 0px;
      padding: 0px;
      background-color: #ffffff;
    "
  >
    <table
      role="presentation"
      style="
        width: 100%;
        border-collapse: collapse;
        border: 0px;
        border-spacing: 0px;
        font-family: Arial, Helvetica, sans-serif;
        background-color: rgb(239, 239, 239);
      "
    >
      <tbody>
        <tr>
          <td
            align="center"
            style="padding: 1rem 2rem; vertical-align: top; width: 100%"
          >
            <table
              role="presentation"
              style="
                max-width: 600px;
                border-collapse: collapse;
                border: 0px;
                border-spacing: 0px;
                text-align: left;
              "
            >
              <tbody>
                <tr>
                  <td style="padding: 40px 0px 0px">
                    <div style="text-align: left">
                      <div style="padding-bottom: 20px; display: flex">
                        <div
                          style="
                            background-color: #ffffff;
                            padding: 10px;
                            border-radius: 100%;
                            width: 36px;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                          "
                        >
                          <img
                            src="https://neststudyroom.s3.ap-south-1.amazonaws.com/main_logo.png"
                            alt="Library Logo"
                            style="width: auto; height: 36px; margin: auto"
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      style="
                        padding: 20px;
                        background-color: rgb(255, 255, 255);
                        border-radius: 10px;
                      "
                    >
                      <div style="color: rgb(0, 0, 0); text-align: left">
                        <div class="f-fallback">
                          <h1>Dear Library Owner,</h1>
                          <p>
                            We are pleased to inform you that a new user has
                            successfully joined ${library_name}.
                          </p>
                          <p>
                            User Name: <strong>${user_name}</strong><br />
                            Plan: <strong>${user_plan_name}</strong><br />
                            Price: <strong>${user_plan_price}</strong><br />
                            Start Date: <strong>${start_date}</strong>
                          </p>
                          <p>
                            Please review the user's details and provide any
                            necessary support to ensure a smooth onboarding
                            experience.
                          </p>
                          <p>
                            For more details, you can visit the library's
                            dashboard here:
                            <a
                              href="${process.env.FRONTEND_URL}/dashboard/${library_id}"
                              class="button"
                              target="_blank"
                              >Library Dashboard</a
                            >.
                          </p>
                         <p style="padding-bottom: 16px">
                          Thanks,<br />The My Abhyasika team
                        </p>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>

  `;

    const mailOptions = {
      from: `'My Abhyasika' <${process.env.Mail_ID}>`,
      to: ownerEmail,
      subject: `New User Enrollment at ${library_name}`,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Library owner notification email sent: %s', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending library owner notification email:', error);
      throw error;
    }
  }

  async send_user_pdf({
    ownerEmail,
    user_name,
    library_name,
    pdfBuffer,
    to,
  }: {
    ownerEmail: string;
    user_name: string;
    library_name: string;
    pdfBuffer: Express.Multer.File; // Ensure pdfBuffer is a Buffer containing the PDF data
    to: string;
  }) {
    // Reconstructing HTML content for the library owner notification
    const htmlContent = `
  <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
  <html xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Welcome to ${library_name}</title>
      <style>
        .copy-button {
          background-color: #4caf50;
          color: white;
          border: none;
          padding: 10px 20px;
          text-align: center;
          text-decoration: none;
          display: inline-block;
          font-size: 16px;
          margin: 4px 2px;
          cursor: pointer;
          border-radius: 5px;
          width: max-content;
        }
      </style>
    </head>
    <body
      style="
        font-family: Helvetica, Arial, sans-serif;
        margin: 0px;
        padding: 0px;
        background-color: #ffffff;
      "
    >
      <table
        role="presentation"
        style="
          width: 100%;
          border-collapse: collapse;
          border: 0px;
          border-spacing: 0px;
          font-family: Arial, Helvetica, sans-serif;
          background-color: rgb(239, 239, 239);
        "
      >
        <tbody>
          <tr>
            <td
              align="center"
              style="padding: 1rem 2rem; vertical-align: top; width: 100%"
            >
              <table
                role="presentation"
                style="
                  max-width: 600px;
                  border-collapse: collapse;
                  border: 0px;
                  border-spacing: 0px;
                  text-align: left;
                "
              >
                <tbody>
                  <tr>
                    <td style="padding: 40px 0px 0px">
                      <div style="text-align: left">
                        <div style="padding-bottom: 20px; display: flex">
                          <div
                            style="
                              background-color: #ffffff;
                              padding: 10px;
                              border-radius: 100%;
                              width: 36px;
                              display: flex;
                              justify-content: center;
                              align-items: center;
                            "
                          >
                            <img
                              src="https://neststudyroom.s3.ap-south-1.amazonaws.com/main_logo.png"
                              alt="Library Logo"
                              style="width: auto; height: 36px; margin: auto"
                            />
                          </div>
                        </div>
                      </div>
                      <div
                        style="
                          padding: 20px;
                          background-color: rgb(255, 255, 255);
                          border-radius: 10px;
                        "
                      >
                        <div style="color: rgb(0, 0, 0); text-align: left">
                          <div class="f-fallback">
                            <h1>Hi ${user_name},</h1>
                            <p>
                              Congratulations on joining ${library_name}! We are excited to welcome you to our community.
                            </p>
                            <p>
                              You have successfully enrolled in the <strong>${library_name}</strong>. We hope this plan meets all your expectations and provides great value.
                            </p>
                            <p>
                              A detailed receipt has been attached to this email in PDF format for your records.
                            </p>

                            <p>
                              If you have any questions or require further assistance, please don't hesitate to contact us at 
                              <a href="mailto:${ownerEmail}">${ownerEmail}</a>.
                            </p>
                            <p>
                              We look forward to supporting your learning journey.
                            </p>
                            <p>
                              Best Regards,<br />
                              The ${library_name} Team
                            </p>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </body>
  </html>
`;

    const mailOptions = {
      from: `'My Abhyasika' <${process.env.Mail_ID}>`,
      to: to,
      subject: `New User Enrollment at ${library_name}`,
      html: htmlContent,
      attachments: [
        {
          filename: 'receipt.pdf', // Specify the name of the PDF file
          content: pdfBuffer.buffer, // Attach the PDF buffer
          contentType: 'application/pdf', // Specify the content type
        },
      ],
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Library owner notification email sent: %s', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending library owner notification email:', error);
      throw error;
    }
  }
  async send_inquiry_email({
    first_name,
    last_name,
    email,
    phone,
    message,
  }: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    message: string;
  }) {
    // Constructing HTML email content
    const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Inquiry</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f9f9f9;
            padding: 20px;
          }
          .container {
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
          h1 {
            color: #333333;
          }
          p {
            color: #555555;
          }
          .contact-info {
            margin-top: 20px;
            padding: 10px;
            background-color: #f1f1f1;
            border-radius: 5px;
          }
          .contact-info p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>New Inquiry from ${first_name} ${last_name}</h1>
          <p><strong>Message:</strong> ${message}</p>

          <div class="contact-info">
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
          </div>
        </div>
      </body>
    </html>
  `;

    // Email options
    const mailOptions = {
      from: `'Inquiry Form' <${process.env.Mail_ID}>`, // Sender's email (from environment variable)
      to: process.env.RECEIVER_EMAIL, // This could be a customer support email where inquiries are sent
      subject: `New Inquiry from ${first_name} ${last_name}`,
      html: htmlContent,
    };

    try {
      // Sending email using nodemailer
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Inquiry email sent: %s', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending inquiry email:', error);
      throw error;
    }
  }
  async send_thankyou_email({
    first_name,
    last_name,
    email,
  }: {
    first_name: string;
    last_name: string;
    email: string;
  }) {
    // Constructing HTML thank-you email content
    const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Thank You for Contacting Us</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f9f9f9;
            padding: 20px;
          }
          .container {
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
          h1 {
            color: #333333;
          }
          p {
            color: #555555;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Thank You for Contacting Us, ${first_name} ${last_name}!</h1>
          <p>
            We have received your message and our team will get back to you as soon as possible.
          </p>
          <p>
            If you have any urgent inquiries, feel free to reply to this email or contact us directly at our support email.
          </p>
          <p>
            We appreciate your interest, and we look forward to assisting you!
          </p>
          <p>Best regards,</p>
          <p>The Support Team</p>
        </div>
      </body>
    </html>
  `;

    // Email options
    const mailOptions = {
      from: `'Support Team' <${process.env.Mail_ID}>`, // Sender's email
      to: email, // Send thank you email to the user
      subject: `Thank You for Contacting Us, ${first_name}!`,
      html: htmlContent,
    };

    try {
      // Sending thank-you email using nodemailer
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Thank you email sent: %s', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending thank you email:', error);
      throw error;
    }
  }
  catch(error) {
    console.error('Error sending welcome email:', error);
  }

  async send_seat_confirmation_email(props: ConfirmationTemplateEmailDto) {
    const {
      library_name,
      library_contact,
      library_url,
      student_email,
      student_name,
      student_contact,
      student_seat,
      library_image
    } = props;

    const htmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Confirm Your Reservation for Ambition Study Room</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f3f4f6;
        margin: 0;
        padding: 20px;
        color: #333;
      }
      .email-container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      .logo-container {
        text-align: center;
        padding: 24px;
        background-color: #f9fafb;
      }
      .logo {
        width: 192px;
        height: 192px;
        object-fit: contain;
      }
      .content {
        padding: 24px;
      }
      .message {
        margin-bottom: 24px;
      }
      .title {
        font-size: 20px;
        font-weight: 600;
        margin-bottom: 16px;
        color: #1f2937;
      }
      .highlight-box {
        background-color: #f9fafb;
        padding: 16px;
        border-radius: 6px;
        margin-bottom: 16px;
      }
      .emphasis {
        font-weight: 600;
      }
      .signature {
        margin-top: 24px;
      }
      .organization {
        font-weight: 600;
        color: #1f2937;
      }
      .phone {
        color: #6b7280;
      }
      .footer {
        padding: 0 24px 24px;
      }
      .button {
        display: block;
        width: 100%;
        padding: 12px 0;
        background-color: #f3f4f6;
        color: #1f2937;
        text-align: center;
        text-decoration: none;
        font-weight: 600;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        transition: background-color 0.15s ease-in-out;
      }
      .button:hover {
        background-color: #e5e7eb;
      }
      .button-content {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .icon {
        width: 20px;
        height: 20px;
        margin-right: 8px;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="logo-container">
        <img
          src="${library_image}"
          alt="My Abhyasika Logo"
          class="logo"
        />
      </div>
      <div class="content">
        <div class="message">
          <h1 class="title">
            Confirm Your Reservation for ${library_name}
          </h1>
          <p>Dear ${student_name},</p>
          <p>
            We hope this message finds you well. Your reservation for ${library_name} is currently pending confirmation for next month.
          </p>
          <div class="highlight-box">
            <p>
              To secure your reserved seat ${student_seat}, please log in using your
              <span class="emphasis">${student_email}</span> and
              confirm your reservation as soon as possible. Failure to do so
              will result in your seat being assigned to another member, and you
              will be responsible for any inconvenience caused.
            </p>
          </div>
          <p>Thank you for your prompt attention to this matter.</p>
        </div>
        <div class="signature">
          <p>Best regards,</p>
          <p class="organization">${library_name}</p>
          <p class="phone">${library_contact}</p>
        </div>
      </div>
      <div class="footer">
        <a href="https://${library_url}.abhyasika.online/" class="button">
          <span class="button-content">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
              ></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            Visit website
          </span>
        </a>
      </div>
    </div>
  </body>
</html>`
    const mailOptions = {
      from: `'My Abhyasika' <${process.env.Mail_ID}>`,
      to: student_email,
      subject: `Confirm Your Reservation for ${library_name}`,
      html: htmlContent,
    };
    console.log(`🚀 ~ file: email.service.ts:1142 ~ EmailService ~ mailOptions.student_email:`, student_email)

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Seat confirmation email sent: %s', info.messageId);
      return info;
    } catch (error) {
      console.error('Error sending seat confirmation email:', error);
      throw error;
    }
  }

}
