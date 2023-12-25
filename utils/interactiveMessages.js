module.exports = [
  {
    id: 'CPV',
    type: 'list',
    header: {
      type: 'text',
      text: 'شركة CPV العربية ترحب بكم!',
    },
    body: {
      text: 'كيف يمكنني مساعدتك اليوم؟',
    },
    footer: {
      text: 'قم باختيار احد الخيارات التالية',
    },
    action: {
      button: 'الاختيارات', // max 20 characters
      sections: [
        {
          // title: 'Agree or Refuse', // max 24 characters
          rows: [
            {
              id: 'Agree',
              title: 'Agree', // max 24 characters
              // description: 'This is to agree testing', // max 72 characters
            },
            {
              id: 'Refuse',
              title: 'Refuse',
              // description: 'This is to refuse testing',
            },
          ],
        },
      ],
    },
  },
  // {
  //   type: 'list',
  //   header: {
  //     type: 'text',
  //     text: 'Testing List Message',
  //   },
  //   body: {
  //     text: 'This is a test to check sending list messages',
  //   },
  //   footer: {
  //     text: 'choose from the list below',
  //   },
  //   action: {
  //     button: 'list options',
  //     sections: [
  //       {
  //         title: 'Agree or Refuse',
  //         rows: [
  //           {
  //             id: 'Agree',
  //             title: 'Agree',
  //             description: 'This is to agree testing',
  //           },
  //           {
  //             id: 'Refuse',
  //             title: 'Refuse',
  //             description: 'This is to refuse testing',
  //           },
  //         ],
  //       },
  //     ],
  //   },
  // },
  {
    type: 'button',
    header: {
      type: 'text',
      text: 'شركة CPV العربية ترحب بكم!',
    },
    body: {
      text: 'كيف يمكنني مساعدتك اليوم؟',
    },
    footer: {
      text: 'قم باختيار احد الخيارات التالية',
    },
    action: {
      buttons: [
        {
          type: 'reply',
          reply: {
            id: 'appointments',
            title: 'المواعيد',
          },
        },
        {
          type: 'reply',
          reply: {
            id: 'Inquiries',
            title: 'الاستفسارات',
          },
        },
        {
          type: 'reply',
          reply: {
            id: 'customer_service',
            title: 'خدمة العملاء',
          },
        },
      ],
    }, // end of action
  },
];
