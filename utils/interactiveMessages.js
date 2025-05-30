module.exports = [
  // CPV
  {
    id: 'CPV',
    type: 'list',
    header: {
      type: 'text',
      text: 'شركة CPV العربية ترحب بكم',
    },
    body: {
      text: 'كيف يمكننى مساعدتك اليوم؟',
    },
    footer: {
      text: 'قم باختيار احد الخيارات التالية',
    },
    action: {
      button: 'الاختيارات', // max 20 characters
      sections: [
        {
          rows: [
            { id: 'inspection', title: 'خدمات الفاحص الفني' },
            { id: 'inquiries', title: 'للاستفسارات والاقتراحات' },
            { id: 'questions', title: 'الأسئلة الشائعة' },
            { id: 'customer_service', title: 'للتواصل مع خدمة العملاء' },
          ],
        },
      ],
    },
  },

  // Main menu
  {
    id: 'main',
    type: 'list',
    body: {
      text: 'قم باختيار احد الخيارات التالية',
    },
    action: {
      button: 'الاختيارات', // max 20 characters
      sections: [
        {
          rows: [
            { id: 'inspection', title: 'خدمات الفاحص الفني' },
            { id: 'inquiries', title: 'للاستفسارات والاقتراحات' },
            { id: 'questions', title: 'الأسئلة الشائعة' },
            { id: 'customer_service', title: 'للتواصل مع خدمة العملاء' },
          ],
        },
      ],
    },
  },

  //Error Message
  {
    id: 'error',
    type: 'list',
    body: {
      text: 'قم باختيار احد الخيارات التالية',
    },
    action: {
      button: 'الاختيارات', // max 20 characters
      sections: [
        {
          rows: [
            { id: 'inspection', title: 'خدمات الفاحص الفني' },
            { id: 'inquiries', title: 'للاستفسارات والاقتراحات' },
            { id: 'questions', title: 'الأسئلة الشائعة' },
            { id: 'customer_service', title: 'للتواصل مع خدمة العملاء' },
          ],
        },
      ],
    },
  },

  // Ref Error
  {
    id: 'ref_error',
    type: 'button',
    body: {
      text: 'عفوا هذا الرقم المرجعي غير موجود بالنظام. هل تريد المحاولة باستخدام رقم مرجعي اخر',
    },
    action: {
      buttons: [
        { type: 'reply', reply: { id: 'ref', title: 'نعم' } },
        { type: 'reply', reply: { id: 'main', title: 'القائمة الرئيسية' } },
      ],
    },
  },

  // Inspection
  {
    id: 'inspection',
    type: 'list',
    body: { text: 'للاختيار من خدمات الفاحص الفني' },
    action: {
      button: 'الاختيارات',
      sections: [
        {
          rows: [
            {
              id: 'inspector_phone',
              title: 'رقم الفاحص الفني',
              description: 'لطلب رقم الفاحص الفني الخاص بمشروعكم',
            },
            {
              id: 'visits_reports',
              title: 'تقارير الزيارات',
              description: 'لطلب تقارير الزيارات الخاصة بالمشروع',
            },
            {
              id: 'project_tickets',
              title: 'ملاحظات المشروع',
              description: 'لمعرفة الملاحظات الخاصة بمشروعكم',
            },
            {
              id: 'missing_data',
              title: 'البيانات المطلوبة',
              description: 'لمعرفة البيانات المطلوبة الخاصة بمشروعكم',
            },
            {
              id: 'payment_status',
              title: 'حالة السداد',
              description: 'لمعرفة حالة السداد',
            },
            { id: 'main', title: 'القائمة السابقة' },
          ],
        },
      ],
    },
  },

  // questions
  {
    id: 'questions',
    type: 'list',
    body: { text: 'للاختيار من الأسئلة الشائعة' },
    action: {
      button: 'الاختيارات',
      sections: [
        {
          rows: [
            { id: 'contractor_instructions', title: 'تعليمات المقاول' },
            { id: 'inspection_stages', title: 'مراحل الفحص الفني' },
            { id: 'common_questions', title: 'الاسئلة الشائعة' },
            { id: 'complete_building', title: 'اجراءات المبانى المكتملة' },
            { id: 'work_hours', title: 'أوقات العمل الرسمية' },
            { id: 'main', title: 'القائمة السابقة' },
          ],
        },
      ],
    },
  },

  // check helpful or not
  {
    id: 'check',
    type: 'button',
    body: {
      text: 'هل تمت الاجابة على استفسارك؟',
    },
    action: {
      buttons: [
        { type: 'reply', reply: { id: 'end', title: 'نعم' } },
        { type: 'reply', reply: { id: 'customer_service', title: 'لا' } },
      ],
    },
  },

  //////////////////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////

  // check continue feedback or leave
  {
    id: 'checkFeedback',
    type: 'button',
    body: {
      text: 'هل تريد مغادرة التقييم؟',
    },
    action: {
      buttons: [
        { type: 'reply', reply: { id: 'end', title: 'نعم' } },
        { type: 'reply', reply: { id: 'feedback_1', title: 'لا' } },
      ],
    },
  },

  // feedback questions
  {
    id: 'feedback_1',
    type: 'list',
    body: {
      text: 'كيف تقيم معرفة الموظف بمتطلباتك وقدرته علي الإجابة عن استفساراتك؟',
    },
    action: {
      button: 'الاختيارات',
      sections: [
        {
          rows: [
            { id: '1', title: 'راضي تمام' },
            { id: '2', title: 'راضي' },
            { id: '3', title: 'محايد' },
            { id: '4', title: 'غير راضي' },
            { id: '5', title: 'غير راضي اطلاقا' },
          ],
        },
      ],
    },
  },

  {
    id: 'feedback_2',
    type: 'list',
    body: {
      text: 'هل كان الموظف واضحا في شرح المعلومات والإجراءات؟',
    },
    action: {
      button: 'الاختيارات',
      sections: [
        {
          rows: [
            { id: '6', title: 'راضي تمام' },
            { id: '7', title: 'راضي' },
            { id: '8', title: 'محايد' },
            { id: '9', title: 'غير راضي' },
            { id: '10', title: 'غير راضي اطلاقا' },
          ],
        },
      ],
    },
  },

  {
    id: 'feedback_3',
    type: 'list',
    body: {
      text: 'كيف تقيم تجربتك العامة مع خدمة العملاء؟',
    },
    action: {
      button: 'الاختيارات',
      sections: [
        {
          rows: [
            { id: '11', title: 'راضي تمام' },
            { id: '12', title: 'راضي' },
            { id: '13', title: 'محايد' },
            { id: '14', title: 'غير راضي' },
            { id: '15', title: 'غير راضي اطلاقا' },
          ],
        },
      ],
    },
  },

  {
    // // Regions
    // {
    //   id: 'regions',
    //   type: 'list',
    //   header: {
    //     type: 'text',
    //     text: 'المناطق',
    //   },
    //   body: { text: 'برجاء اختيار المنطقة' },
    //   action: {
    //     button: 'المناطق',
    //     sections: [
    //       {
    //         rows: [
    //           { id: 'middle', title: 'المنطقة الوسطي' },
    //           { id: 'east', title: 'المنطقة الشرقية' },
    //           { id: 'west', title: 'المنطقة الغربية' },
    //           { id: 'north', title: 'المنطقة الشمالية' },
    //           { id: 'south', title: 'المنطقة الجنوبية' },
    //           { id: '', title: 'القائمة السابقة' },
    //         ],
    //       },
    //     ],
    //   },
    // },
    // // Middle
    // {
    //   id: 'middle',
    //   type: 'button',
    //   header: { type: 'text', text: 'المدن' },
    //   body: { text: 'برجاء اختيار المدينة المقام فيها المشروع' },
    //   action: {
    //     buttons: [
    //       { type: 'reply', reply: { id: 'riyadh', title: 'الرياض' } },
    //       { type: 'reply', reply: { id: '', title: 'بريدة' } },
    //       { type: 'reply', reply: { id: 'regions', title: 'القائمة السابقة' } },
    //     ],
    //   },
    // },
    // // Riyadh
    // {
    //   id: 'riyadh',
    //   type: 'list',
    //   header: { type: 'text', text: 'المدن' },
    //   body: { text: 'برجاء اختيار المدينة المقام فيها المشروع' },
    //   action: {
    //     button: 'المدن',
    //     sections: [
    //       {
    //         rows: [
    //           { id: '', title: 'شمال الرياض' },
    //           { id: '', title: 'جنوب الرياض' },
    //           { id: '', title: 'شرق الرياض' },
    //           { id: '', title: 'غرب الرياض' },
    //           { id: '', title: 'الخرج - هياثم - الدلم - حوطة بني تميم' },
    //           { id: 'middle', title: 'القائمة السابقة' },
    //         ],
    //       },
    //     ],
    //   },
    // },
    // // West
    // {
    //   id: 'west',
    //   type: 'button',
    //   header: { type: 'text', text: 'المدن' },
    //   body: { text: 'برجاء اختيار المدينة المقام فيها المشروع' },
    //   action: {
    //     buttons: [
    //       { type: 'reply', reply: { id: '', title: 'جدة' } },
    //       { type: 'reply', reply: { id: '', title: 'المدينة المنورة' } },
    //       { type: 'reply', reply: { id: 'regions', title: 'القائمة السابقة' } },
    //     ],
    //   },
    // },
    // // East
    // {
    //   id: 'east',
    //   type: 'list',
    //   header: { type: 'text', text: 'المدن' },
    //   body: { text: 'برجاء اختيار المدينة المقام فيها المشروع' },
    //   action: {
    //     button: 'المدن',
    //     sections: [
    //       {
    //         rows: [
    //           { id: '', title: 'القطيف والجبيل وصفوة' },
    //           { id: '', title: 'الراكة - الظهران -الفاخرية' },
    //           { id: '', title: 'العزيزية - الخبر' },
    //           { id: '', title: 'غرب الدمام' },
    //           { id: '', title: 'الطرف - ضاحية هجر - القري الشرقية' },
    //           {
    //             id: '',
    //             title:
    //               'المبرز - العيون - جواثا - الشعبة - بقيق - وجهة شمال الاحساء',
    //           },
    //           { id: '', title: 'الهفوف - الحزام الأخضر - شرق الحديقة' },
    //           { id: 'regions', title: 'القائمة السابقة' },
    //         ],
    //       },
    //     ],
    //   },
    // },
    // // North
    // {
    //   id: 'north',
    //   type: 'list',
    //   header: { type: 'text', text: 'المدن' },
    //   body: { text: 'برجاء اختيار المدينة المقام فيها المشروع' },
    //   action: {
    //     button: 'المدن',
    //     sections: [
    //       {
    //         rows: [{ id: '', title: 'حائل' }],
    //         rows: [{ id: '', title: 'تبوك' }],
    //         rows: [{ id: '', title: 'سكاكا' }],
    //         rows: [{ id: 'regions', title: 'القائمة السابقة' }],
    //       },
    //     ],
    //   },
    // },
    // // South
    // {
    //   id: 'south',
    //   type: 'list',
    //   header: { type: 'text', text: 'المدن' },
    //   body: { text: 'برجاء اختيار المدينة المقام فيها المشروع' },
    //   action: {
    //     button: 'المدن',
    //     sections: [
    //       {
    //         rows: [
    //           {
    //             id: '',
    //             title:
    //               'خميس مشيط - احد رفيده - وادي بن هشيل - المقطاة -سراة عبيدة - الواديين',
    //           },
    //           { id: '', title: 'الباحة' },
    //           { id: '', title: 'نجران' },
    //           { id: '', title: 'أبها' },
    //           {
    //             id: '',
    //             title:
    //               'جازان - بيش - أبو عريش - صبيا جازان العاصمة - صامطا - الدرب',
    //           },
    //           { id: '', title: 'المخواة' },
    //           { id: '', title: 'بيشة - تثليث' },
    //           { id: 'regions', title: 'القائمة السابقة' },
    //         ],
    //       },
    //     ],
    //   },
    // },
  },
];
