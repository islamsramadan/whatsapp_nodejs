const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');

const fs = require('fs');
const path = require('path');
const Email = require('../models/ticketSystem/emailModel');

// sendEmail(
//   'islammansour42@gmail.com,islams.ramadan@outlook.com',
//   'Sending Email using Node.js',
//   'That was easy!'
// );

exports.sendEmail = (to, subject, text) => {
  const service = process.env.EMAIL_SERVICE;
  const from = process.env.EMAIL_USERNAME;
  const pass = process.env.EMAIL_PASSWORD;

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

const {
  MailerSend,
  Sender,
  Recipient,
  EmailParams,
  Attachment,
} = require('mailersend');

exports.mailerSendEmail = async (emailDetails) => {
  const mailerSend = new MailerSend({
    apiKey: process.env.MAILERSEND_TOKEN,
  });

  // test mail sender
  // const sentFrom = new Sender(
  //   'MS_UTHnaw@trial-pq3enl6e7x742vwr.mlsender.net',
  //   'CPV Arabia'
  // );

  // production mail sender
  const sentFrom = new Sender('customercare@cpvarabia.com');

  const recipients = [
    // new Recipient('islamlaam@gmail.com'),
    new Recipient(emailDetails.to),
  ];

  const attachments = emailDetails.attachments.map((item) => {
    return new Attachment(
      fs.readFileSync(`public/${item.file}`, {
        encoding: 'base64',
      }),
      item.filename,
      'attachment'
    );
  });

  const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setReplyTo(sentFrom)
    .setAttachments(attachments)
    .setSubject(emailDetails.subject)
    // .setHtml('<strong>This is to test receiving emails</strong>');
    .setText(emailDetails.text);
  // .setTemplateId(emailDetails.template)
  // .setVariables(emailDetails.variables);

  const results = await mailerSend.email.send(emailParams);

  console.log(
    'JSON.stringify(results) ==================== ',
    JSON.stringify(results)
  );
};

const attachments = [
  { file: '1.png', filename: '1.png' },
  { file: '3.png', filename: '3.png' },
  { file: 'test pdf.pdf', filename: 'test pdf.pdf' },
  { file: 'test word.docx', filename: 'test word.docx' },
];
const variables = [
  {
    email: 'islamlaam@gmail.com',
    substitutions: [
      {
        var: 'date',
        value: 'test',
      },
      {
        var: 'name',
        value: 'test',
      },
      {
        var: 'total',
        value: 'test',
      },
      {
        var: 'amount',
        value: 'test',
      },
      {
        var: 'due_date',
        value: 'test',
      },
      {
        var: 'action_url',
        value: 'test',
      },
      {
        var: 'invoice_id',
        value: 'test',
      },
      {
        var: 'description',
        value: 'test',
      },
      {
        var: 'support_url',
        value: 'test',
      },
      {
        var: 'account.name',
        value: 'test',
      },
    ],
  },
];
const emailDetails = {
  attachments,
  to: 'islamlaam@gmail.com',
  subject: 'cpv welcome',
  text: 'Hello from the other side!',
  // html: '',
  template: 'x2p0347kqdklzdrn',
  variables,
};

// mailerSendEmail(emailDetails);

// =========================================================
// =========================================================
// =========================================================

const imapConfig = {
  user: 'islamlaam@gmail.com',
  password: 'hflamyyxqcsnqdoj',
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }, // This allows self-signed certificates
};

const getOtherEmails = async () => {
  const imap = new Imap(imapConfig);

  const openInbox = (cb) => {
    imap.openBox('INBOX', false, cb);
  };

  imap.once('ready', function () {
    openInbox(function (err, box) {
      if (err) throw err;
      console.log('Opened inbox');

      imap.on('mail', function () {
        // This event is triggered when new mail arrives
        fetchNewEmails();
      });

      fetchNewEmails(); // Fetch emails on startup
    });
  });

  imap.once('error', function (err) {
    console.error('error ---------------', err);
  });

  imap.once('end', function () {
    console.log('Connection ended');
  });

  const fetchNewEmails = () => {
    imap.search(
      ['UNSEEN', ['SINCE', 'July 20, 2024']],
      function (err, results) {
        if (err) throw err;

        if (results.length === 0) {
          console.log('No new emails');
          return;
        }

        const fetch = imap.fetch(results, { bodies: '' });
        fetch.on('message', function (msg, seqno) {
          console.log('Message #%d', seqno);
          const prefix = '(#' + seqno + ') ';

          msg.on('body', function (stream, info) {
            simpleParser(stream, async (err, parsed) => {
              if (err) {
                console.error('Error parsing email:', err);
                return;
              }

              let attachments;
              if (parsed.attachments && parsed.attachments.length > 0) {
                attachments = parsed.attachments.map((attachment) => {
                  const filename = `ticket-${Date.now()}-${Math.floor(
                    Math.random() * 1000000
                  )}-${attachment.filename}`;

                  fs.writeFile(
                    `public/${filename}`,
                    attachment.content,
                    (err) => {
                      if (err) {
                        console.error(
                          `Failed to save ${attachment.filename}:`,
                          err
                        );
                      } else {
                        // console.log(
                        //   `${attachment.filename} saved successfully.`
                        // );
                      }
                    }
                  );
                  return {
                    file: filename,
                    filename: attachment.filename,
                  };
                });
              }

              const data = { ...parsed };
              data.attachments = attachments;
              data.headers = undefined;
              data.headerLines = undefined;

              console.log('parsed data =========================== ', data);

              const emailsWithSameID = await Email.find({
                messageId: data.messageId,
              });
              if (emailsWithSameID.length === 0) {
                await Email.create(data);
              }
            });
          });

          msg.once('attributes', function (attrs) {
            const { uid } = attrs;
            imap.addFlags(uid, ['\\Seen'], (err) => {
              if (err) {
                console.error('Error marking email as seen:', err);
              } else {
                console.log('Marked email as seen');
              }
            });
          });
        });

        fetch.once('error', function (err) {
          console.error('Fetch error:', err);
        });

        fetch.once('end', function () {
          console.log('Done fetching new emails');
        });
      }
    );
  };

  imap.connect();
};
// getOtherEmails();
