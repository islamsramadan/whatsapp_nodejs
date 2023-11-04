const Team = require('../models/teamModel');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Chat = require('./../models/chatModel');

exports.getAllChats = catchAsync(async (req, res, next) => {
  const chats = await Chat.find().sort('-updatedAt').populate('lastMessage');

  res.status(200).json({
    status: 'success',
    results: chats.length,
    data: {
      chats,
    },
  });
});

exports.createChat = catchAsync(async (req, res, next) => {
  const userTeam = await Team.findById(req.user._id);
  if (!userTeam) {
    return next(
      new AppError("This user doesn't belong to any existed team!", 400)
    );
  }

  const newChat = await Chat.create({
    client: req.body.client,
    currentUser: req.user._id,
    users: [req.user._id],
    team: userTeam._id,
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
    chat.currentUser = undefined;
    chat.status = 'archived';
    await chat.save();
    // Removing chat from user open chats
    await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { chats: chat._id } },
      { new: true, runValidators: true }
    );

    //**********the user in chat team take the ownership
  } else if (type === 'takeOwnership') {
    chat.currentUser = req.user._id;
    //Add new user to the array of users
    if (!chat.users.includes(req.user._id)) {
      chat.users = [...chat.users, req.user._id];
    }
    await chat.save();
    //Add the chat to the user open chats
    if (!req.user.chats.includes(chat._id)) {
      await User.findByIdAndUpdate(
        req.user._id,
        { chats: [...req.user.chats, chat._id] },
        { new: true, runValidators: true }
      );
    }

    //**********Transfer to another user in the same team
  } else if (type === 'transferToUser') {
    const user = await User.findById(req.body.user);
    if (!user) {
      return next(new AppError('No user found with that ID', 404));
    }
    //Remove chat from user open chats
    await User.findByIdAndUpdate(
      chat.currentUser,
      { $pull: { chats: chat._id } },
      { new: true, runValidators: true }
    );

    chat.currentUser = req.body.user;
    //Add new user to the array of users
    if (!chat.users.includes(req.body.user)) {
      chat.users = [...chat.users, req.body.user];
    }
    await chat.save();

    //Adding the chat to the new user
    // user.chats = [...user.chats, chat._id];
    // await user.save();
    await User.findByIdAndUpdate(
      req.body.user,
      {
        $push: { chats: chat._id },
      },
      { new: true, runValidators: true }
    );

    //********** Transfer the chat to another team and remove the current user
  } else if (type === 'transferToTeam') {
    const team = await Team.findById(req.body.team);
    if (!team) {
      return next(new AppError('No team found with that ID!', 404));
    }
    if (team._id === chat.team) {
      return next(new AppError("Couldn't transfer to the same team!", 400));
    }

    //Selecting chat current user
    const teamUsers = [];
    team.users.map(async function (user) {
      let teamUser = await User.findById(user);
      teamUsers = teamUsers.push(teamUser);
    });
    teamUsers = teamUsers.sort((a, b) => a.chats.length - b.chats.length);

    //Update chat
    chat.team = req.body.team;
    chat.currentUser = teamUsers[0]._id;
    await chat.save();

    //Update selected user open chats
    if (!teamUsers[0].chats.includes(chat._id)) {
      await User.findByIdAndUpdate(
        teamUsers[0]._id,
        { $push: { chats: chat._id } },
        { new: true, runValidators: true }
      );
    }
  }

  res.status(200).json({
    status: 'success',
    message: 'Chat updated successfully!',
  });
});
