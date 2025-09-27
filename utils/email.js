const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send email function
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
};

// Send reminder email
const sendReminderEmail = async (userEmail, tasks) => {
  const subject = 'Task Reminders - Due Soon';
  const html = `
    <h2>Your upcoming tasks:</h2>
    <ul>
      ${tasks.map(task => `<li><strong>${task.title}</strong> - Due: ${new Date(task.due_date).toLocaleDateString()}</li>`).join('')}
    </ul>
    <p>Please check your tasks in TaskFlow.</p>
  `;

  return sendEmail(userEmail, subject, html);
};

// Send invitation email
const sendInvitationEmail = async (inviteeEmail, teamName, inviterName) => {
  const subject = `Invitation to join ${teamName}`;
  const html = `
    <h2>You've been invited to join ${teamName}!</h2>
    <p>${inviterName} has invited you to join their team on TaskFlow.</p>
    <p>Please log in to accept the invitation.</p>
  `;

  return sendEmail(inviteeEmail, subject, html);
};

module.exports = {
  sendEmail,
  sendReminderEmail,
  sendInvitationEmail
};