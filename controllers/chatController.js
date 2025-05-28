const mongoose = require('mongoose');

const ChatHistory = require('../models/historyModel');
const Session = require('../models/sessionModel');
const Team = require('../models/teamModel');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Chat = require('./../models/chatModel');
const Log = require('../models/logModel');
const Notification = require('../models/notificationModel');
const interactiveMessages = require('../utils/interactiveMessages');
const { default: axios } = require('axios');
const Message = require('../models/messageModel');

const chatBotTimerUpdate = require('../utils/chatBotTimerUpdate');

exports.getAllChats = catchAsync(async (req, res, next) => {
  let chats = await Chat.find()
    .sort('-updatedAt')
    .populate('lastMessage')
    .populate('lastSession', 'status secret')
    .populate('contactName', 'name number')
    .populate('endUser', 'name phone nationalID')
    .lean();

  chats = chats.map((chat) => {
    if (chat.lastMessage?.secret === true) {
      return {
        ...chat,
        lastMessage: {
          _id: chat.lastMessage._id,
          status: chat.lastMessage.status,
          received: chat.lastMessage.received,
          sent: chat.lastMessage.sent,
          delivered: chat.lastMessage.delivered,
          read: chat.lastMessage.read,
        },
      };
    } else {
      return chat;
    }
  });

  res.status(200).json({
    status: 'success',
    results: chats.length,
    data: {
      chats,
    },
  });
});

exports.getAllUserChats = catchAsync(async (req, res, next) => {
  let statuses = req.query.status.split(',');
  if (statuses.includes('all')) {
    statuses = ['open', 'onTime', 'danger', 'tooLate'];
  }

  let chats = await Chat.find({ currentUser: req.user._id })
    .sort('-updatedAt')
    .populate('lastMessage')
    .populate('lastSession', 'status secret')
    .populate('contactName', 'name number')
    .populate('endUser', 'name phone nationalID')
    .lean();

  // console.log('statuses', statuses);
  chats = chats.filter((chat) => statuses.includes(chat.lastSession?.status));

  chats = chats.map((chat) => {
    if (chat.lastMessage?.secret === true) {
      return {
        ...chat,
        lastMessage: {
          _id: chat.lastMessage._id,
          status: chat.lastMessage.status,
          received: chat.lastMessage.received,
          sent: chat.lastMessage.sent,
          delivered: chat.lastMessage.delivered,
          read: chat.lastMessage.read,
        },
      };
    } else {
      return chat;
    }
  });

  res.status(200).json({
    status: 'success',
    results: chats.length,
    data: {
      chats,
    },
  });
});

exports.getAllTeamChats = catchAsync(async (req, res, next) => {
  let statuses = req.query.status.split(',');
  if (statuses.includes('all')) {
    statuses = ['open', 'onTime', 'danger', 'tooLate'];
  }

  const teamsIDs = req.query.teams.split(',');
  if (teamsIDs.length === 0) {
    return next(new AppError('Teams IDs are required!', 400));
  }

  let chats = await Chat.find({
    team: { $in: teamsIDs },
    // team: req.user.team,
  })
    .sort('-updatedAt')
    .populate('lastMessage')
    .populate('lastSession', 'status secret')
    .populate('contactName', 'name number')
    .populate('endUser', 'name phone nationalID')
    .lean();

  // console.log('statuses', statuses);
  chats = chats.filter((chat) => statuses.includes(chat.lastSession?.status));

  chats = chats.map((chat) => {
    if (chat.lastMessage?.secret === true) {
      return {
        ...chat,
        lastMessage: {
          _id: chat.lastMessage._id,
          status: chat.lastMessage.status,
          received: chat.lastMessage.received,
          sent: chat.lastMessage.sent,
          delivered: chat.lastMessage.delivered,
          read: chat.lastMessage.read,
        },
      };
    } else {
      return chat;
    }
  });

  res.status(200).json({
    status: 'success',
    results: chats.length,
    data: {
      chats,
    },
  });
});

exports.getAllTeamUserChats = catchAsync(async (req, res, next) => {
  let chats = await Chat.find({ currentUser: req.params.userID })
    .sort('-updatedAt')
    .populate('lastMessage')
    .populate('lastSession', 'status secret')
    .populate('contactName', 'name number')
    .populate('endUser', 'name phone nationalID')
    .lean();

  chats = chats.map((chat) => {
    if (chat.lastMessage?.secret === true) {
      return {
        ...chat,
        lastMessage: {
          _id: chat.lastMessage._id,
          status: chat.lastMessage.status,
          received: chat.lastMessage.received,
          sent: chat.lastMessage.sent,
          delivered: chat.lastMessage.delivered,
          read: chat.lastMessage.read,
        },
      };
    } else {
      return chat;
    }
  });

  res.status(200).json({
    status: 'success',
    results: chats.length,
    data: {
      chats,
    },
  });
});

exports.getAllArchivedChats = catchAsync(async (req, res, next) => {
  const page = req.query.page || 1;
  let chats, totalResults, totalPages;

  if (req.query.userID) {
    const userID = req.query.userID;
    const sessionFilterObj = {
      status: 'finished',
      end: { $exists: true },
      user: userID,
    };

    if (req.query.startDate)
      sessionFilterObj.end = { $gt: new Date(req.query.startDate) };

    if (req.query.endDate) {
      const endDate = new Date(req.query.endDate);
      endDate.setDate(endDate.getDate() + 1);

      sessionFilterObj.end = {
        ...sessionFilterObj.end,
        $lt: endDate,
      };
    }

    const sessions = await Session.find(sessionFilterObj);
    const chatsIDs = sessions.map((session) => session.chat);
    chats = await Chat.find({ _id: { $in: chatsIDs } })
      .sort('-updatedAt')
      .populate('lastMessage')
      .populate('lastSession', 'status secret')
      .populate('contactName', 'name number')
      .populate('endUser', 'name phone nationalID')
      .limit(page * 10)
      .lean();

    chats = chats.map((chat) => {
      if (chat.lastMessage?.secret === true) {
        return {
          ...chat,
          lastMessage: {
            _id: chat.lastMessage._id,
            status: chat.lastMessage.status,
            received: chat.lastMessage.received,
            sent: chat.lastMessage.sent,
            delivered: chat.lastMessage.delivered,
            read: chat.lastMessage.read,
          },
        };
      } else {
        return chat;
      }
    });

    totalResults = await Chat.count({ _id: { $in: chatsIDs } });
    totalPages = Math.ceil(totalResults / 10);
  } else {
    const chatFilterObj = { status: 'archived' };

    if (req.query.startDate)
      chatFilterObj.updatedAt = { $gt: new Date(req.query.startDate) };

    if (req.query.endDate) {
      const endDate = new Date(req.query.endDate);
      endDate.setDate(endDate.getDate() + 1);

      chatFilterObj.updatedAt = {
        ...chatFilterObj.updatedAt,
        $lt: endDate,
      };
    }

    chats = await Chat.find(chatFilterObj)
      .sort('-updatedAt')
      .populate('lastMessage')
      .populate('lastSession', 'status secret')
      .populate('contactName', 'name number')
      .populate('endUser', 'name phone nationalID')
      .limit(page * 10)
      .lean();

    chats = chats.map((chat) => {
      if (chat.lastMessage?.secret === true) {
        return {
          ...chat,
          lastMessage: {
            _id: chat.lastMessage._id,
            status: chat.lastMessage.status,
            received: chat.lastMessage.received,
            sent: chat.lastMessage.sent,
            delivered: chat.lastMessage.delivered,
            read: chat.lastMessage.read,
          },
        };
      } else {
        return chat;
      }
    });

    totalResults = await Chat.count(chatFilterObj);
    totalPages = Math.ceil(totalResults / 10);
  }

  res.status(200).json({
    status: 'success',
    results: chats.length,
    data: {
      totalResults,
      totalPages,
      chats,
    },
  });
});

exports.createChat = catchAsync(async (req, res, next) => {
  const userTeam = await Team.findById(req.user.team);
  if (!userTeam) {
    return next(
      new AppError("This user doesn't belong to any existed team!", 400)
    );
  }

  const newChat = await Chat.create({
    client: req.body.client,
    // currentUser: req.user._id,
    users: [req.user._id],
    // team: req.user.team,
    status: 'archived',
  });

  res.status(201).json({
    status: 'success',
    data: {
      chat: newChat,
    },
  });
});

exports.updateChat = catchAsync(async (req, res, next) => {
  const chat = await Chat.findById(req.params.chatID);
  if (!chat) {
    return next(new AppError('No chat found with that ID!', 404));
  }

  const { type } = req.body;
  if (!type) {
    return next(new AppError('Kindly provide the type of update!', 400));
  }

  const transactionSession = await mongoose.startSession();
  transactionSession.startTransaction();

  const notificationUsersIDs = new Set();
  let updatedChat;
  let feedbackSession;
  try {
    //**********Update chat notification
    if (type === 'notification') {
      if (req.body?.notification === false) {
        updatedChat = await Chat.findByIdAndUpdate(
          chat._id,
          { notification: false },
          { new: true, runValidators: true, session: transactionSession }
        );
      } else {
        return next(new AppError('Kindly provide notification status!', 400));
      }

      //**********Archive chat
    } else if (type === 'archive') {
      // if (chat.notification === true) {
      //   return next(
      //     new AppError("Couldn't archive chat with unread messages", 400)
      //   );
      // }

      if (chat.status === 'archived') {
        return next(new AppError('The chat is already archived!', 400));
      }

      if (!chat.currentUser.equals(req.user._id) && req.user.role !== 'admin') {
        return next(
          new AppError("You don't have permission to perform this action!", 403)
        );
      }

      // Add end date to the session and remove it from chat
      await Session.findByIdAndUpdate(
        chat.lastSession,
        { end: Date.now(), status: 'finished', $unset: { timer: '' } },
        { new: true, runValidators: true, session: transactionSession }
      );

      // =======> Create chat history session
      const chatHistoryData = {
        chat: chat._id,
        user: req.user._id,
        actionType: 'archive',
        archive: 'user',
      };
      await ChatHistory.create([chatHistoryData], {
        session: transactionSession,
      });

      // =======> Archive Chat Notification
      if (!chat.currentUser.equals(req.user._id)) {
        const archiveNotificationData = {
          type: 'messages',
          user: chat.currentUser,
          chat: chat._id,
          session: chat.lastSession,
          event: 'archiveChat',
          message: `Chat number ${chat.client} has been archived by ${req.user.firstName} ${req.user.lastName}`,
        };
        const archiveNotification = await Notification.create(
          [archiveNotificationData],
          {
            session: transactionSession,
          }
        );

        console.log('archiveNotification', archiveNotification);

        notificationUsersIDs.add(chat.currentUser);
      }
      // Updating chat
      await Chat.findByIdAndUpdate(
        chat._id,
        {
          status: 'archived',
          $unset: { currentUser: '', team: '', lastSession: '' },
        },
        { new: true, runValidators: true, session: transactionSession }
      );

      // Removing chat from user open chats
      await User.findByIdAndUpdate(
        req.user._id,
        { $pull: { chats: chat._id } },
        { new: true, runValidators: true, session: transactionSession }
      );

      //**********the user in chat team take the ownership
    } else if (type === 'feedback') {
      //********** Archive and Feedback
      // if (chat.notification === true) {
      //   return next(
      //     new AppError("Couldn't archive chat with unread messages", 400)
      //   );
      // }

      if (chat.status === 'archived') {
        return next(new AppError('The chat is already archived!', 400));
      }

      if (!chat.currentUser.equals(req.user._id) && req.user.role !== 'admin') {
        return next(
          new AppError("You don't have permission to perform this action!", 403)
        );
      }

      // Add end date to the session and remove it from chat
      await Session.findByIdAndUpdate(
        chat.lastSession,
        { end: Date.now(), status: 'finished', $unset: { timer: '' } },
        { new: true, runValidators: true, session: transactionSession }
      );

      // =======> Create chat history session
      const chatHistoryData = {
        chat: chat._id,
        user: req.user._id,
        actionType: 'archive',
        archive: 'user',
      };
      await ChatHistory.create([chatHistoryData], {
        session: transactionSession,
      });

      // =======> Archive Chat Notification
      if (!chat.currentUser.equals(req.user._id)) {
        const archiveNotificationData = {
          type: 'messages',
          user: chat.currentUser,
          chat: chat._id,
          session: chat.lastSession,
          event: 'archiveChat',
          message: `Chat number ${chat.client} has been archived by ${req.user.firstName} ${req.user.lastName}`,
        };
        const archiveNotification = await Notification.create(
          [archiveNotificationData],
          {
            session: transactionSession,
          }
        );

        console.log('archiveNotification', archiveNotification);

        notificationUsersIDs.add(chat.currentUser);
      }
      // // Updating chat
      // await Chat.findByIdAndUpdate(
      //   chat._id,
      //   {
      //     status: 'archived',
      //     $unset: { currentUser: '', team: '', lastSession: '' },
      //   },
      //   { new: true, runValidators: true, session: transactionSession }
      // );

      // Removing chat from user open chats
      await User.findByIdAndUpdate(
        req.user._id,
        { $pull: { chats: chat._id } },
        { new: true, runValidators: true, session: transactionSession }
      );

      ////////////////////////////////////////
      ////////////////////////////////////////
      ////////////////////////////////////////
      ////////////////////////////////////////
      ////////////////////////////////////////
      ////////////////////////////////////////

      // Create new bot session for the feedback
      const botTeam = await Team.findOne({ bot: true }).session(
        transactionSession
      );
      const newSession = await Session.create(
        [
          {
            chat: chat._id,
            user: botTeam.supervisor,
            team: botTeam._id,
            status: 'open',
            type: 'feedback',
          },
        ],
        { session: transactionSession }
      );

      // Updating chat
      await Chat.findByIdAndUpdate(
        chat._id,
        {
          currentUser: botTeam.supervisor,
          team: botTeam._id,
          lastSession: newSession[0]._id,
        },
        { new: true, runValidators: true, session: transactionSession }
      );

      feedbackSession = newSession[0];
      // //===========> Sending feedback interactive message
      // const interactiveMsgObj = interactiveMessages.filter(
      //   (item) => item.id === 'feedback_1'
      // )[0];
      // const interactiveMsg = { ...interactiveMsgObj };
      // delete interactiveMsg.id;
      // const interactiveReplyMsg = {
      //   type: 'interactive',
      //   interactive: interactiveMsg,
      // };

      // await sendMessageHandler(req, interactiveReplyMsg, chat, newSession[0]);

      //**********the user in chat team take the ownership
    } else if (type === 'takeOwnership') {
      // if (chat.notification === true) {
      //   return next(
      //     new AppError("Couldn't transfer chat with unread messages", 400)
      //   );
      // }

      // console.log('chat.team', chat.team);
      if (!chat.team.equals(req.user.team) && req.user.role !== 'admin') {
        return next(
          new AppError("You don't have permission to perform this action!", 403)
        );
      }

      // to update later
      const previousUserID = chat.currentUser;

      // Add end date to the session and creat new one
      await Session.findByIdAndUpdate(
        chat.lastSession,
        { end: Date.now(), status: 'finished', $unset: { timer: '' } },
        { new: true, runValidators: true, session: transactionSession }
      );
      const newSession = await Session.create(
        [
          {
            chat: chat._id,
            user: req.user._id,
            team: chat.team,
            status: 'open',
          },
        ],
        { session: transactionSession }
      );

      // =======> Create chat history session
      const chatHistoryData = {
        chat: chat._id,
        user: req.user._id,
        actionType: 'takeOwnership',
        takeOwnership: { from: chat.currentUser, to: req.user._id },
      };
      await ChatHistory.create([chatHistoryData], {
        session: transactionSession,
      });

      const chatUpdatedBody = {
        currentUser: req.user._id,
        lastSession: newSession[0]._id,
      };
      //Add new user to the array of users
      if (!chat.users.includes(req.user._id)) {
        chatUpdatedBody.$push = { users: req.user._id };
      }

      await Chat.findByIdAndUpdate(chat._id, chatUpdatedBody, {
        new: true,
        runValidators: true,
        session: transactionSession,
      });

      //Add the chat to the user open chats
      if (!req.user.chats.includes(chat._id)) {
        await User.findByIdAndUpdate(
          req.user._id,
          { $push: { chats: chat._id } },
          { new: true, runValidators: true, session: transactionSession }
        );
      }

      //Remove the chat from the previous user open chats
      await User.findByIdAndUpdate(
        previousUserID,
        { $pull: { chats: chat._id } },
        { new: true, runValidators: true, session: transactionSession }
      );

      // =======> Take Chat Ownership Notification
      const transferNotificationData = {
        type: 'messages',
        user: chat.currentUser,
        chat: chat._id,
        session: chat.lastSession,
        event: 'chatTransfer',
        message: `Chat number ${chat.client} has been transfered to ${req.user.firstName} ${req.user.lastName}`,
      };
      const transferNotification = await Notification.create(
        [transferNotificationData],
        {
          session: transactionSession,
        }
      );

      console.log('transferNotification', transferNotification);

      notificationUsersIDs.add(chat.currentUser);

      //**********Transfer to another user in the same team
    } else if (type === 'transferToUser') {
      // if (chat.notification === true) {
      //   return next(
      //     new AppError("Couldn't transfer chat with unread messages", 400)
      //   );
      // }

      if (!chat.team.equals(req.user.team) && req.user.role !== 'admin') {
        return next(
          new AppError("You don't have permission to perform this action!", 403)
        );
      }

      // to update later
      const previousUserID = chat.currentUser;

      const user = await User.findOne({ _id: req.body.user, deleted: false });
      if (!user) {
        return next(new AppError('No user found with that ID', 404));
      }

      if (!user.team.equals(chat.team)) {
        return next(
          new AppError("Couldn't transfer to users outside the team", 400)
        );
      }

      // Add end date to the session and creat new one
      await Session.findByIdAndUpdate(
        chat.lastSession,
        { end: Date.now(), status: 'finished', $unset: { timer: '' } },
        { new: true, runValidators: true, session: transactionSession }
      );
      const newSession = await Session.create(
        [
          {
            chat: chat._id,
            user: req.body.user,
            team: chat.team,
            status: 'open',
          },
        ],
        { session: transactionSession }
      );

      // =======> Create chat history session
      const chatHistoryData = {
        chat: chat._id,
        user: req.user._id,
        actionType: 'transfer',
        transfer: { type: 'user', from: chat.currentUser, to: req.body.user },
      };
      await ChatHistory.create([chatHistoryData], {
        session: transactionSession,
      });

      const chatUpdatedBody = {
        currentUser: req.body.user,
        lastSession: newSession[0]._id,
      };
      //Add new user to the array of users
      if (!chat.users.includes(req.body.user)) {
        chatUpdatedBody.$push = { users: req.body.user };
      }

      await Chat.findByIdAndUpdate(chat._id, chatUpdatedBody, {
        new: true,
        runValidators: true,
        session: transactionSession,
      });

      //Remove chat from user open chats
      await User.findByIdAndUpdate(
        previousUserID,
        { $pull: { chats: chat._id } },
        { new: true, runValidators: true, session: transactionSession }
      );

      //Adding the chat to the new user
      await User.findByIdAndUpdate(
        req.body.user,
        {
          $push: { chats: chat._id },
        },
        { new: true, runValidators: true, session: transactionSession }
      );

      // =======> Transfer Chat Notification
      const transferNotificationData = {
        type: 'messages',
        // user: chat.currentUser,
        chat: chat._id,
        // session: chat.lastSession,
        event: 'chatTransfer',
      };

      // --------> Transfer To Notification
      if (!req.user._id.equals(req.body.user)) {
        const previousUserDoc = await User.findById(previousUserID).select(
          'firstName lastName'
        );
        const transferToNotification = await Notification.create(
          [
            {
              ...transferNotificationData,
              user: req.body.user,
              session: newSession[0]._id,
              message: `Chat number ${chat.client} has been transfered from ${previousUserDoc.firstName} ${previousUserDoc.lastName}`,
            },
          ],
          {
            session: transactionSession,
          }
        );

        console.log('transferToNotification', transferToNotification);

        notificationUsersIDs.add(req.body.user);
      }

      // --------> Transfer From Notification
      if (!req.user._id.equals(previousUserID)) {
        const newUserDoc = await User.findById(req.body.user).select(
          'firstName lastName'
        );
        const transferFromNotification = await Notification.create(
          [
            {
              ...transferNotificationData,
              user: previousUserID,
              session: chat.lastSession,
              message: `Chat number ${chat.client} has been transfered to ${newUserDoc.firstName} ${newUserDoc.lastName}`,
            },
          ],
          {
            session: transactionSession,
          }
        );

        console.log('transferFromNotification', transferFromNotification);

        notificationUsersIDs.add(previousUserID);
      }

      //********** Transfer the chat to another team and remove the current user
    } else if (type === 'transferToTeam') {
      // if (chat.notification === true) {
      //   return next(
      //     new AppError("Couldn't transfer chat with unread messages", 400)
      //   );
      // }

      if (!chat.team.equals(req.user.team) && req.user.role !== 'admin') {
        return next(
          new AppError("You don't have permission to perform this action!", 403)
        );
      }

      const team = await Team.findById(req.body.team);
      if (!team) {
        return next(new AppError('No team found with that ID!', 404));
      }

      if (team._id.equals(chat.team)) {
        return next(new AppError("Couldn't transfer to the same team!", 400));
      }

      let teamUser;
      if (req.body.teamUser) {
        const user = await User.findById(req.body.teamUser);
        if (user.team.equals(team.id)) {
          teamUser = user;
        }
      }

      //previous chat user to be updated later
      const previousUserID = chat.currentUser;

      if (!teamUser) {
        //Selecting new chat current user
        let teamUsers = [];
        for (let i = 0; i < team.users.length; i++) {
          let teamUser = await User.findOne({
            _id: team.users[i],
            deleted: false,
          });
          teamUsers = [...teamUsers, teamUser];
        }

        // status sorting order
        const statusSortingOrder = [
          'Online',
          'Service hours',
          'Offline',
          'Away',
        ];

        // teamUsers = teamUsers.sort((a, b) => a.chats.length - b.chats.length);
        teamUsers = teamUsers.sort((a, b) => {
          const orderA = statusSortingOrder.indexOf(a.status);
          const orderB = statusSortingOrder.indexOf(b.status);

          // If 'status' is the same, then sort by chats length
          if (orderA === orderB) {
            return a.chats.length - b.chats.length;
          }

          // Otherwise, sort by 'status'
          return orderA - orderB;
        });

        teamUser = teamUsers[0];
      }

      // console.log('teamUsers=============', teamUsers);

      // Add end date to the session and creat new one
      await Session.findByIdAndUpdate(
        chat.lastSession,
        { end: Date.now(), status: 'finished', $unset: { timer: '' } },
        { new: true, runValidators: true, session: transactionSession }
      );
      const newSession = await Session.create(
        [
          {
            chat: chat._id,
            user: teamUser._id,
            team: req.body.team,
            status: 'open',
          },
        ],
        { session: transactionSession }
      );

      // =======> Create chat history session
      const chatHistoryData = {
        chat: chat._id,
        user: req.user._id,
        actionType: 'transfer',
        transfer: {
          type: 'team',
          from: chat.currentUser,
          to: teamUser._id,
          fromTeam: chat.team,
          toTeam: req.body.team,
        },
      };
      await ChatHistory.create([chatHistoryData], {
        session: transactionSession,
      });

      //Update chat
      const chatUpdatedBody = {
        team: req.body.team,
        currentUser: teamUser._id,
        lastSession: newSession[0]._id,
      };
      if (!chat.users.includes(chat.currentUser)) {
        // chat.users = [...chat.users, chat.currentUser];
        chatUpdatedBody.$push = { users: chat.currentUser };
      }

      await Chat.findByIdAndUpdate(chat._id, chatUpdatedBody, {
        new: true,
        runValidators: true,
        session: transactionSession,
      });

      //Update selected user open chats
      if (!teamUser.chats.includes(chat._id)) {
        await User.findByIdAndUpdate(
          teamUser._id,
          { $push: { chats: chat._id } },
          { new: true, runValidators: true, session: transactionSession }
        );
      }

      //Update previous user open chats
      await User.findByIdAndUpdate(
        previousUserID,
        { $pull: { chats: chat._id } },
        { new: true, runValidators: true, session: transactionSession }
      );

      // =======> Transfer Chat Notification
      const transferNotificationData = {
        type: 'messages',
        chat: chat._id,
        event: 'chatTransfer',
      };

      // --------> Transfer To Notification
      const previousUserDoc = await User.findById(previousUserID).select(
        'firstName lastName'
      );
      const transferToNotification = await Notification.create(
        [
          {
            ...transferNotificationData,
            user: teamUser._id,
            session: newSession[0]._id,
            message: `Chat number ${chat.client} has been transfered from ${previousUserDoc.firstName} ${previousUserDoc.lastName}`,
          },
        ],
        {
          session: transactionSession,
        }
      );

      console.log('transferToNotification', transferToNotification);

      notificationUsersIDs.add(teamUser._id);

      // --------> Transfer From Notification
      if (!req.user._id.equals(previousUserID)) {
        const transferFromNotification = await Notification.create(
          [
            {
              ...transferNotificationData,
              user: previousUserID,
              session: chat.lastSession,
              message: `Chat number ${chat.client} has been transfered to ${teamUser.firstName} ${teamUser.lastName}`,
            },
          ],
          {
            session: transactionSession,
          }
        );

        console.log('transferFromNotification', transferFromNotification);

        notificationUsersIDs.add(previousUserID);
      }
    }

    await transactionSession.commitTransaction(); // Commit the transaction
    transactionSession.endSession();
  } catch (error) {
    await transactionSession.abortTransaction();
    transactionSession.endSession();

    console.error('Transaction aborted due to an error:', error);

    await Log.create({
      type: 'chat',
      chat: chat._id,
      user: req.user._id,
      event: `chat update - ${type}`,
    });

    return next(new AppError('Updating chat aborted! Try again later.', 400));
  }

  //updating event in socket io
  req.app.io.emit('updating', { chatID: chat._id });

  //--------------------> updating notifications event in socket io
  Array.from(notificationUsersIDs).map((userID) => {
    if (req.app.connectedUsers[userID]) {
      req.app.connectedUsers[userID].emit('updatingNotifications');
    }
  });

  if (type === 'feedback' && feedbackSession) {
    //===========> Sending feedback interactive message

    const textMsg = {
      type: 'text',
      text: `
      عزيزي العميل

      نشكر تواصلك واهتمامك بخدماتنا. نود الاستماع إلى رأيك حول تجربتك مع موظف خدمة العملاء لتحسين جودة خدماتنا.

      يرجي تقييم النقاط التالية: 
      `,
    };
    await sendMessageHandler(req, textMsg, chat, feedbackSession);

    const interactiveMsgObj = interactiveMessages.filter(
      (item) => item.id === 'feedback_1'
    )[0];
    const interactiveMsg = { ...interactiveMsgObj };
    delete interactiveMsg.id;
    const interactiveReplyMsg = {
      type: 'interactive',
      interactive: interactiveMsg,
    };
    await sendMessageHandler(req, interactiveReplyMsg, chat, feedbackSession);

    // ************* Updating session botTimer **************
    const delayMins = 2;
    // const delayMins = process.env.BOT_EXPIRE_TIME;
    let botTimer = new Date();
    botTimer = botTimer.setTime(botTimer.getTime() + delayMins * 60 * 1000);

    feedbackSession.botTimer = botTimer;
    feedbackSession.reminder = true;
    await feedbackSession.save();

    const sessions = await Session.find({
      status: 'open',
      botTimer: {
        $exists: true,
        $ne: '',
      },
    });

    await chatBotTimerUpdate.scheduleDocumentUpdateTask(
      sessions,
      req,
      //from config.env
      delayMins,
      process.env.RESPONSE_DANGER_TIME,
      process.env.WHATSAPP_VERSION,
      process.env.WHATSAPP_PHONE_ID,
      process.env.WHATSAPP_TOKEN,
      process.env.WHATSAPP_PHONE_NUMBER
    );
  }

  res.status(200).json({
    status: 'success',
    message: 'Chat updated successfully!',
    updatedChat,
  });
});

const sendMessageHandler = async (
  req,
  msgToBeSent,
  selectedChat,
  selectedSession
) => {
  const newMessageObj = {
    user: selectedSession.user,
    chat: selectedChat._id,
    session: selectedSession._id,
    from: process.env.WHATSAPP_PHONE_NUMBER,
    type: msgToBeSent.type,
  };

  if (selectedSession.secret === true) {
    newMessageObj.secret = true;
  }

  const whatsappPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: selectedChat.client,
    type: msgToBeSent.type,
  };

  if (msgToBeSent.type === 'interactive') {
    newMessageObj.interactive = msgToBeSent.interactive;
    whatsappPayload.interactive = msgToBeSent.interactive;
  }
  if (msgToBeSent.type === 'text') {
    newMessageObj.text = msgToBeSent.text;
    whatsappPayload.text = { preview_url: false, body: msgToBeSent.text };
  }
  if (msgToBeSent.type === 'contacts') {
    whatsappPayload.contacts = msgToBeSent.contacts;
    newMessageObj.contacts = msgToBeSent.contacts.map((contact) => ({
      ...contact,
      name: contact.name.formatted_name,
    }));
  }
  if (msgToBeSent.type === 'document') {
    whatsappPayload.document = msgToBeSent.document;
    newMessageObj.document = { type: 'link', ...msgToBeSent.document };
  }

  // console.log('whatsappPayload =======', whatsappPayload);
  // console.log('newMessageObj =======', newMessageObj);

  let response;
  try {
    response = await axios.request({
      method: 'post',
      maxBodyLength: Infinity,
      url: `https://graph.facebook.com/${process.env.WHATSAPP_VERSION}/${process.env.WHATSAPP_PHONE_ID}/messages`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
      data: JSON.stringify(whatsappPayload),
    });
  } catch (err) {
    console.log('err', err);
  }

  if (response) {
    // console.log('response.data----------------', response.data);
    const newMessage = await Message.create({
      ...newMessageObj,
      whatsappID: response.data.messages[0].id,
    });

    // Adding the sent message as last message in the chat and update chat status
    selectedChat.lastMessage = newMessage._id;
    selectedChat.status = 'open';
    // updating chat notification to false
    selectedChat.notification = false;
    await selectedChat.save();

    // Updating session to new status ((open))
    selectedSession.status = 'open';
    selectedSession.timer = undefined;
    if (selectedSession.type === 'bot' || selectedSession.type === 'feedback')
      selectedSession.lastBotMessage = newMessage._id;
    await selectedSession.save();

    //updating event in socket io
    req.app.io.emit('updating', { chatID: selectedChat._id });
  }
};
