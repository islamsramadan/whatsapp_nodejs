function handleSocketEvent(socket, io) {
  socket.on('getMessages', (payload) => {});
}

// io.on('connection', (socket) => {
//   // console.log('socket', socket);
//   console.log('Socket server is connected successfully!');

//   socket.on('chat', (payload) => {
//     console.log('payload ============', payload);
//     io.emit('chat', payload);
//   });
// });

module.exports = handleSocketEvent;
