require("dotenv").config();
const { Server } = require("socket.io");

const io = new Server(process.env.PORT || 3000, { cors: { origin: "*" } });

const promptArr = require("./prompts");

let usersArr = [];
let lobbiesArr = [];

io.on("connection", (socket) => {
  socket.on("new-user", (username) => {
    if (usersArr.some((user) => user.name === username)) {
      socket.emit("username-exists");
    } else {
      usersArr.push({ name: username, id: socket.id });
      socket.emit("join-successful");
      io.emit("new-user", usersArr, lobbiesArr);
    }
  });
  socket.on("new-lobby", (lobbyName) => {
    if (lobbiesArr.some((lobby) => lobby.name === lobbyName)) {
      socket.emit("lobbyname-exists");
    } else {
      const user = usersArr.find((user) => user.id === socket.id);
      lobbiesArr.push({
        name: lobbyName,
        inGame: false,
        ownerId: socket.id,
        users: [user],
      });
      socket.emit("create-lobby-successful");
      io.emit("new-lobby", lobbiesArr);
    }
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
  socket.on("game-start", (lobby, numberOfRounds) => {
    const lobbyIndex = lobbiesArr.findIndex((l) => l.name === lobby.name);
    lobbiesArr[lobbyIndex].inGame = true;
    lobbiesArr[lobbyIndex].answersCount = 0;
    lobbiesArr[lobbyIndex].currentRound = 1;
    lobbiesArr[lobbyIndex].totalRounds = numberOfRounds;
    lobbiesArr[lobbyIndex].letter = getRandomAlphabetLetter();
    lobbiesArr[lobbyIndex].prompt = getRandomPrompt();
    lobbiesArr[lobbyIndex].users.forEach((u) => {
      u.currentScore = 0;
      u.totalScore = 0;
    });
    io.emit("game-start", lobbiesArr, lobbyIndex);
  });
  socket.on("join-room", (lobby) => {
    socket.join(lobby.name);
  });
  socket.on("submit-answer", (answer, lobby) => {
    const lobbyIndex = lobbiesArr.findIndex((l) => l.name === lobby.name);
    lobbiesArr[lobbyIndex].users.forEach((u) => {
      if (u.id === socket.id) u.answer = answer;
    });
    lobbiesArr[lobbyIndex].answersCount++;
    if (lobbiesArr[lobbyIndex].answersCount === lobby.users.length) {
      lobbiesArr[lobbyIndex].users = shuffle(lobbiesArr[lobbyIndex].users);
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
  socket.on("next-round", (lobby) => {
    const lobbyIndex = lobbiesArr.findIndex((l) => l.name === lobby.name);
    lobbiesArr[lobbyIndex].currentRound++;
    if (
      lobbiesArr[lobbyIndex].currentRound > lobbiesArr[lobbyIndex].totalRounds
    ) {
      lobbiesArr[lobbyIndex].users.sort((a, b) => b.totalScore - a.totalScore);
      io.to(lobby.name).emit("game-over", lobbiesArr[lobbyIndex]);
    } else {
      lobbiesArr[lobbyIndex].letter = getRandomAlphabetLetter();
      lobbiesArr[lobbyIndex].prompt = getRandomPrompt();
      io.to(lobby.name).emit("next-round", lobbiesArr[lobbyIndex]);
    }
  });
  socket.on("end-game", (lobby) => {
    const lobbyIndex = lobbiesArr.findIndex((l) => l.name === lobby.name);
    lobbiesArr[lobbyIndex].inGame = false;
    io.to(lobby.name).emit("end-game", lobby);
    io.emit("lobby-ended-game", lobbiesArr);
  });
  socket.on("leave-room", (lobby) => {
    socket.leave(lobby.name);
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

  function getRandomAlphabetLetter() {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  function getRandomPrompt() {
    return promptArr[Math.floor(Math.random() * promptArr.length)];
  }

  function shuffle(array) {
    let m = array.length;

    // While there remain elements to shuffle…
    while (m) {
      // Pick a remaining element…
      let i = Math.floor(Math.random() * m--);

      // And swap it with the current element.
      [array[m], array[i]] = [array[i], array[m]];
    }

    return array;
  }
});
