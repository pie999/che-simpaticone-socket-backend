require("dotenv").config();
const { Server } = require("socket.io");

const io = new Server(3000, { cors: { origin: "*" } });

let usersArr = [];
let lobbiesArr = [];

io.on("connection", (socket) => {
  socket.on("new-user", (newUser) => {
    usersArr.push(newUser);
    io.emit("new-user", usersArr, lobbiesArr);
  });
  socket.on("new-lobby", (newLobby) => {
    lobbiesArr.push(newLobby);
    io.emit("new-lobby", lobbiesArr);
  });
  socket.on("lobby-join", (lobbyName, user) => {
    removeCurrentUserFromLobbies();
    const lobby = lobbiesArr.find((lobby) => lobby.name === lobbyName);
    lobby.users.push(user);
    io.emit("lobby-join", lobbiesArr);
  });
  socket.on("lobby-exit", (lobbyIndex) => {
    removeCurrentUserFromSpecificLobby(lobbyIndex);
    io.emit("lobby-exit", lobbiesArr);
  });
  socket.on("game-start", (lobbyIndex) => {
    lobbiesArr[lobbyIndex].answersCount = 0;
    lobbiesArr[lobbyIndex].users.forEach((u) => {
      u.currentScore = 0;
      u.totalScore = 0;
    });
    io.emit("game-start", lobbiesArr, lobbyIndex);
  });
  socket.on("join-room", (lobbyIndex) => {
    socket.join(lobbiesArr[lobbyIndex].name);
  });
  socket.on("submit-answer", (answer, lobby) => {
    const lobbyIndex = lobbiesArr.findIndex((l) => l.name === lobby.name);
    lobbiesArr[lobbyIndex].users.forEach((u, i) => {
      if (u.id === socket.id) u.answer = answer;
    });
    lobbiesArr[lobbyIndex].answersCount++;
    if (lobbiesArr[lobbyIndex].answersCount === lobby.users.length) {
      io.to(lobby.name).emit("submit-answer", lobbiesArr[lobbyIndex]);
      lobbiesArr[lobbyIndex].answersCount = 0;
    }
  });
  socket.on("update-score", (votedIndex, lobby) => {
    const lobbyIndex = lobbiesArr.findIndex((l) => l.name === lobby.name);
    lobbiesArr[lobbyIndex].users[votedIndex].currentScore++;
    lobbiesArr[lobbyIndex].answersCount++;
    if (lobbiesArr[lobbyIndex].answersCount === lobby.users.length) {
      lobbiesArr[lobbyIndex].users.forEach(
        (u) => (u.totalScore += u.currentScore)
      );
      io.to(lobby.name).emit("update-score", lobbiesArr[lobbyIndex]);
      lobbiesArr[lobbyIndex].answersCount = 0;
      lobbiesArr[lobbyIndex].users.forEach((u) => (u.currentScore = 0));
    }
  });
  socket.on("disconnect", () => {
    removeCurrentUserFromUsers();
    removeCurrentUserFromLobbies();
    io.emit("user-disconnected", usersArr, lobbiesArr);
  });

  function removeCurrentUserFromUsers() {
    usersArr.forEach((user, i) => {
      if (user.id === socket.id) usersArr.splice(i, 1);
    });
  }

  function removeCurrentUserFromLobbies() {
    lobbiesArr.forEach((lobby, lobbyInd) => {
      lobby.users.forEach((us, usInd) => {
        if (us.id === socket.id) {
          lobby.users.splice(usInd, 1);
          if (lobby.users.length === 0) lobbiesArr.splice(lobbyInd, 1);
          else if (us.id === lobby.ownerId) lobby.ownerId = lobby.users[0].id;
        }
      });
    });
  }

  function removeCurrentUserFromSpecificLobby(lobbyIndex) {
    const lobby = lobbiesArr[lobbyIndex];
    lobby.users.forEach((u, i) => {
      if (u.id === socket.id) {
        lobby.users.splice(i, 1);
        if (lobby.users.length === 0) lobbiesArr.splice(i, 1);
        else if (u.id === lobby.ownerId) lobby.ownerId = lobby.users[0].id;
      }
    });
  }
});
