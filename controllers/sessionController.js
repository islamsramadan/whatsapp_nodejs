const Session = require('../models/sessionModel');
const Team = require('../models/teamModel');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

exports.getAllSessions = catchAsync(async (req, res, next) => {
  let userSessions = await Session.find({
    user: req.user._id,
    // status: { $ne: 'finished' },
    end: { $exists: false },
  }).populate('chat');
  userSessions = userSessions.filter((session) =>
    session._id.equals(session.chat.lastSession)
  );

  const userSessionsfilters = {
    all: userSessions.length,
    onTime: userSessions.filter((session) => session.status === 'onTime')
      .length,
    danger: userSessions.filter((session) => session.status === 'danger')
      .length,
    tooLate: userSessions.filter((session) => session.status === 'tooLate')
      .length,
    open: userSessions.filter((session) => session.status === 'open').length,
  };

  const teamsIDs = req.params.teamsIDs?.split(',');
  if (teamsIDs.length === 0) {
    return next(new AppError('Teams IDs are required!', 400));
  }

  if (
    (teamsIDs.length > 1 ||
      (teamsIDs.length === 1 && !req.user.team.equals(teamsIDs[0]))) &&
    req.user.role !== 'admin'
  ) {
    return next(
      new AppError("You don't have permission to perform this action!", 403)
    );
  }
  // console.log('teamsIDs', teamsIDs);

  let teamSessions = await Session.find({
    team: { $in: teamsIDs },
    // team: req.user.team,
    // status: { $ne: 'finished' },
    end: { $exists: false },
  }).populate('chat');

  teamSessions = teamSessions.filter((session) =>
    session._id.equals(session.chat.lastSession)
  );
  const teamSessionsfilters = {
    all: teamSessions.length,
    onTime: teamSessions.filter((session) => session.status === 'onTime')
      .length,
    danger: teamSessions.filter((session) => session.status === 'danger')
      .length,
    tooLate: teamSessions.filter((session) => session.status === 'tooLate')
      .length,
    open: teamSessions.filter((session) => session.status === 'open').length,
  };

  // const teams = await Promise.all(
  //   teamsIDs.map(async (teamID) => {
  //     const team = await Team.findById(teamID);

  //     const teamUsers = await Promise.all(
  //       team.users.map(async (userID) => {
  //         const user = await User.findById(userID);
  //         const userSessions = await Session.find({
  //           user: userID,
  //           // status: { $ne: 'finished' },
  //           end: { $exists: false },
  //         });
  //         const userSessionsfilters = {
  //           all: userSessions.length,
  //           onTime: userSessions.filter(
  //             (session) => session.status === 'onTime'
  //           ).length,
  //           danger: userSessions.filter(
  //             (session) => session.status === 'danger'
  //           ).length,
  //           tooLate: userSessions.filter(
  //             (session) => session.status === 'tooLate'
  //           ).length,
  //           open: userSessions.filter((session) => session.status === 'open')
  //             .length,
  //         };

  //         return {
  //           _id: userID,
  //           firstName: user.firstName,
  //           lastName: user.lastName,
  //           sessions: userSessionsfilters,
  //         };
  //       })
  //     );

  //     return { _id: teamID, team: team.name, users: teamUsers };
  //   })
  // );

  res.status(200).json({
    status: 'success',
    data: {
      usersSessions: userSessionsfilters,
      teamSessions: teamSessionsfilters,
      // teams,
    },
  });
});

exports.getTeamUsersSessions = catchAsync(async (req, res, next) => {
  const teamsIDs = req.params.teamsIDs?.split(',');
  if (teamsIDs.length === 0) {
    return next(new AppError('Teams IDs are required!', 400));
  }

  const teams = await Promise.all(
    teamsIDs.map(async (teamID) => {
      const team = await Team.findById(teamID);

      const teamUsers = await Promise.all(
        team.users.map(async (userID) => {
          const user = await User.findById(userID);
          if (user) {
            let userSessions = await Session.find({
              user: userID,
              // status: { $ne: 'finished' },
              end: { $exists: false },
            }).populate('chat');

            userSessions = userSessions.filter(
              (session) =>
                session._id.equals(session.chat.lastSession) &&
                session.chat.currentUser &&
                session.chat.currentUser.equals(userID)
            );

            const userSessionsfilters = {
              all: userSessions.length,
              onTime: userSessions.filter(
                (session) => session.status === 'onTime'
              ).length,
              danger: userSessions.filter(
                (session) => session.status === 'danger'
              ).length,
              tooLate: userSessions.filter(
                (session) => session.status === 'tooLate'
              ).length,
              open: userSessions.filter((session) => session.status === 'open')
                .length,
            };

            return {
              _id: userID,
              firstName: user.firstName,
              lastName: user.lastName,
              photo: user.photo,
              status: user.status,
              sessions: userSessionsfilters,
            };
          }
        })
      );

      return { _id: teamID, teamName: team.name, users: teamUsers };
    })
  );

  res.status(200).json({
    status: 'success',
    results: teams.length,
    data: {
      teams,
    },
  });
});
