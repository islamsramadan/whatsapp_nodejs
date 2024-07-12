const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');

// sendEmail(
//   'gmail',
//   'islamlaam@gmail.com',
//   'hflamyyxqcsnqdoj',
//   'islammansour42@gmail.com,islams.ramadan@outlook.com',
//   'Sending Email using Node.js',
//   'That was easy!'
// );

exports.sendEmail = (service, from, pass, to, subject, text) => {
  const transporter = nodemailer.createTransport({
    service, // or your email service
    auth: {
      user: from,
      pass,
    },
  });

  const mailOptions = {
    from,
    to,
    subject,
    text,
    // html: '<h1>Welcome</h1><p>That was easy!</p>',
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log('error ------------------------> ', error);
    } else {
      console.log('Email sent: =========================> ' + info.response);
    }
  });
};

const imapConfig = {
  user: 'islamlaam@gmail.com',
  password: 'hflamyyxqcsnqdoj',
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }, // This allows self-signed certificates
};

const getEmails = async () => {
  return new Promise((resolve, reject) => {
    try {
      const imap = new Imap(imapConfig);
      let emails = [];

      imap.once('ready', () => {
        imap.openBox('INBOX', false, () => {
          imap.search(['UNSEEN', ['SINCE', new Date()]], (err, results) => {
            if (err) {
              reject(err);
              return;
            }
            if (!results.length) {
              resolve(emails); // No emails found
              return;
            }
            const f = imap.fetch(results, { bodies: '' });
            f.on('message', (msg) => {
              msg.on('body', (stream) => {
                simpleParser(stream, (err, parsed) => {
                  console.log('parsed ==========================', err);
                  if (err) {
                    reject(err);
                    return;
                  }
                  emails.push(parsed);
                  console.log(
                    'emails =================================== 76',
                    emails
                  );
                });
              });
              // msg.once('attributes', (attrs) => {
              //   const { uid } = attrs;
              //   imap.addFlags(uid, ['\\Seen'], () => {
              //     console.log('Marked as read!');
              //   });
              // });
            });
            f.once('error', (ex) => {
              reject(ex);
            });
            f.once('end', () => {
              console.log('emails ======================== ', emails);
              console.log('Done fetching all messages!');
              imap.end();
              resolve(emails); // Resolve with the collected emails
            });
          });
        });
      });

      imap.once('error', (err) => {
        console.log(err);
        reject(err);
      });

      imap.once('end', () => {
        console.log('Connection ended');
      });

      imap.connect();
    } catch (ex) {
      console.log('An error occurred');
      reject(ex);
    }
  });
};

// Usage with async/await
exports.readEmail = async () => {
  try {
    const emails = await getEmails();
    console.log(
      'Retrieved emails: =========================================',
      emails
    );
    return emails;
  } catch (error) {
    console.error('Error:', error);
  }
};

// ***************************************************************************************************************
// ***************************************************************************************************************
// ***************************************************************************************************************

// const nodemailer = require('nodemailer');
// const pug = require('pug');
// const htmlToText = require('html-to-text');

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.url = url;
    this.from = `Jonas Schmedtmann <${process.env.EMAIL_FROM}>`;
  }

  // service, // or your email service
  //   auth: {
  //     user: from,
  //     pass,
  //   },

  newTransport() {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
    // return nodemailer.createTransport({
    //   host: process.env.EMAIL_HOST,
    //   port: process.env.EMAIL_PORT,
    //   auth: {
    //     user: process.env.EMAIL_USERNAME,
    //     pass: process.env.EMAIL_PASSWORD,
    //   },
    // });
  }

  // Send the actual email
  async send(template, subject) {
    // 1) Render HTML based on a pug template
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      url: this.url,
      subject,
    });

    // 2) Define email options
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: htmlToText.fromString(html),
    };

    // 3) Create a transport and send email
    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send('welcome', 'Welcome to the Natours Family!');
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Your password reset token (valid for only 10 minutes)'
    );
  }
};
