const Session = require('../models/sessionModel');
const Team = require('../models/teamModel');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Chat = require('./../models/chatModel');

exports.getAllChats = catchAsync(async (req, res, next) => {
  const chats = await Chat.find()
    .sort('-updatedAt')
    .populate('lastMessage')
    .populate('lastSession', 'status')
    .populate('contactName', 'name');

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
    .populate('lastSession', 'status')
    .populate('contactName', 'name');

  // console.log('statuses', statuses);
  chats = chats.filter((chat) => statuses.includes(chat.lastSession?.status));

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
    .populate('lastSession', 'status')
    .populate('contactName', 'name');

  // console.log('statuses', statuses);
  chats = chats.filter((chat) => statuses.includes(chat.lastSession?.status));

  res.status(200).json({
    status: 'success',
    results: chats.length,
    data: {
      chats,
    },
  });
});

exports.getAllArchivedChats = catchAsync(async (req, res, next) => {
  const chats = await Chat.find({ status: 'archived' })
    .sort('-updatedAt')
    .populate('lastMessage')
    .populate('lastSession', 'status')
    .populate('contactName', 'name');

  res.status(200).json({
    status: 'success',
    results: chats.length,
    data: {
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
    currentUser: req.user._id,
    users: [req.user._id],
    team: req.user.team,
  });

  res.status(201).json({
    status: 'success',
    data: {
      chat: newChat,
    },
  });
});

exports.updateChat = catchAsync(async (req, res, next) => {
  const chat = await Chat.findOne({ client: req.params.chatNumber });
  if (!chat) {
    return next(new AppError('No chat found with that number', 404));
  }

  const { type } = req.body;
  if (!type) {
    return next(new AppError('Kindly provide the type of update!', 400));
  }

  //**********Update chat notification
  if (type === 'notification') {
    if (req.body?.notification === false) {
      chat.notification = false;
      await chat.save();
    } else {
      return next(new AppError('Kindly provide notification status!', 400));
    }

    //**********Archive chat
  } else if (type === 'archive') {
    if (chat.notification === true) {
      return next(
        new AppError("Couldn't archive chat with unread messages", 400)
      );
    }

    if (chat.status === 'archived') {
      return next(new AppError('The chat is already archived!', 400));
    }

    if (!chat.currentUser.equals(req.user._id)) {
      return next(
        new AppError("You don't have permission to perform this action!", 403)
      );
    }

    // Add end date to the session and remove it from chat
    await Session.findByIdAndUpdate(
      chat.lastSession,
      { end: Date.now(), status: 'finished' },
      { new: true, runValidators: true }
    );

    // Updating chat
    chat.currentUser = undefined;
    chat.team = undefined;
    chat.status = 'archived';
    chat.lastSession = undefined;
    await chat.save();

    // Removing chat from user open chats
    await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { chats: chat._id } },
      { new: true, runValidators: true }
    );

    //**********the user in chat team take the ownership
  } else if (type === 'takeOwnership') {
    if (chat.notification === true) {
      return next(
        new AppError("Couldn't transfer chat with unread messages", 400)
      );
    }

    // console.log('chat.team', chat.team);
    if (
      !chat.team.equals(req.user.team) ||
      chat.currentUser.equals(req.user_id)
    ) {
      return next(
        new AppError("You don't have permission to perform this action!", 403)
      );
    }

    // to update later
    const previousUserID = chat.currentUser;

    // Add end date to the session and creat new one
    await Session.findByIdAndUpdate(
      chat.lastSession,
      { end: Date.now(), status: 'finished' },
      { new: true, runValidators: true }
    );
    const newSession = await Session.create({
      chat: chat._id,
      user: req.user._id,
      team: chat.team,
      status: 'open',
    });

    chat.currentUser = req.user._id;
    chat.lastSession = newSession._id;
    //Add new user to the array of users
    if (!chat.users.includes(req.user._id)) {
      chat.users = [...chat.users, req.user._id];
    }
    await chat.save();

    //Add the chat to the user open chats
    if (!req.user.chats.includes(chat._id)) {
      await User.findByIdAndUpdate(
        req.user._id,
        { $push: { chats: chat._id } },
        { new: true, runValidators: true }
      );
    }

    //Remove the chat from the previous user open chats
    await User.findByIdAndUpdate(
      previousUserID,
      { $pull: { chats: chat._id } },
      { new: true, runValidators: true }
    );

    //**********Transfer to another user in the same team
  } else if (type === 'transferToUser') {
    if (chat.notification === true) {
      return next(
        new AppError("Couldn't transfer chat with unread messages", 400)
      );
    }

    if (!chat.team.equals(req.user.team)) {
      return next(
        new AppError("You don't have permission to perform this action!", 403)
      );
    }

    // to update later
    const previousUserID = chat.currentUser;

    const user = await User.findById(req.body.user);
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
      { end: Date.now(), status: 'finished' },
      { new: true, runValidators: true }
    );
    const newSession = await Session.create({
      chat: chat._id,
      user: req.body.user,
      team: chat.team,
      status: 'open',
    });

    chat.currentUser = req.body.user;
    chat.lastSession = newSession._id;
    //Add new user to the array of users
    if (!chat.users.includes(req.body.user)) {
      chat.users = [...chat.users, req.body.user];
    }
    await chat.save();

    //Remove chat from user open chats
    await User.findByIdAndUpdate(
      previousUserID,
      { $pull: { chats: chat._id } },
      { new: true, runValidators: true }
    );

    //Adding the chat to the new user
    await User.findByIdAndUpdate(
      req.body.user,
      {
        $push: { chats: chat._id },
      },
      { new: true, runValidators: true }
    );

    //********** Transfer the chat to another team and remove the current user
  } else if (type === 'transferToTeam') {
    if (chat.notification === true) {
      return next(
        new AppError("Couldn't transfer chat with unread messages", 400)
      );
    }

    if (!chat.team.equals(req.user.team)) {
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

    //previous chat user to be updated later
    const previousUserID = chat.currentUser;

    //Selecting new chat current user
    let teamUsers = [];
    for (let i = 0; i < team.users.length; i++) {
      let teamUser = await User.findById(team.users[i]);
      teamUsers = [...teamUsers, teamUser];
    }

    // status sorting order
    const statusSortingOrder = ['Online', 'Service hours', 'Offline', 'Away'];

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

    // console.log('teamUsers=============', teamUsers);

    // Add end date to the session and creat new one
    await Session.findByIdAndUpdate(
      chat.lastSession,
      { end: Date.now(), status: 'finished' },
      { new: true, runValidators: true }
    );
    const newSession = await Session.create({
      chat: chat._id,
      user: teamUsers[0]._id,
      team: req.body.team,
      status: 'open',
    });

    //Update chat
    chat.team = req.body.team;
    chat.currentUser = teamUsers[0]._id;
    chat.lastSession = newSession._id;
    if (!chat.users.includes(chat.currentUser)) {
      chat.users = [...chat.users, chat.currentUser];
    }
    await chat.save();

    //Update selected user open chats
    if (!teamUsers[0].chats.includes(chat._id)) {
      await User.findByIdAndUpdate(
        teamUsers[0]._id,
        { $push: { chats: chat._id } },
        { new: true, runValidators: true }
      );
    }

    //Update previous user open chats
    await User.findByIdAndUpdate(previousUserID, {
      $pull: { chats: chat._id },
    });
  }

  //updating event in socket io
  req.app.io.emit('updating');

  res.status(200).json({
    status: 'success',
    message: 'Chat updated successfully!',
  });
});
