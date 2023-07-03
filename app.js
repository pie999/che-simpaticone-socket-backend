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
    removeUserFromAllLobbies();
    const lobby = getLobbyFromName(lobbyName);
    lobby.users.push(user);
    io.emit("lobby-join", lobbiesArr);
  });
  socket.on("lobby-exit", (lobbyName) => {
    removeUserFromLobby(lobbyName);
    io.emit("lobby-exit", lobbiesArr);
  });
  socket.on("game-start", (lobbyName, numberOfRounds) => {
    const lobby = getLobbyFromName(lobbyName);
    lobby.inGame = true;
    lobby.answersCount = 0;
    lobby.currentRound = 1;
    lobby.totalRounds = numberOfRounds;
    lobby.letter = getRandomAlphabetLetter();
    lobby.prompt = getRandomPrompt();
    lobby.users.forEach((u) => {
      u.currentScore = 0;
      u.totalScore = 0;
    });
    io.emit("game-start", lobby, lobbiesArr);
  });
  socket.on("join-room", (lobbyName) => {
    socket.join(lobbyName);
  });
  socket.on("submit-answer", (answer, lobbyName) => {
    const lobby = getLobbyFromName(lobbyName);
    lobby.users.forEach((u) => {
      if (u.id === socket.id) u.answer = answer;
    });
    lobby.answersCount++;
    if (lobby.answersCount === lobby.users.length) {
      lobby.users = shuffle(lobby.users);
      io.to(lobby.name).emit("submit-answer", lobby);
      lobby.answersCount = 0;
    }
  });
  socket.on("update-score", (votedIndex, lobbyName) => {
    const lobby = getLobbyFromName(lobbyName);
    lobby.users[votedIndex].currentScore++;
    lobby.answersCount++;
    if (lobby.answersCount === lobby.users.length) {
      lobby.users.forEach((u) => (u.totalScore += u.currentScore));
      io.to(lobby.name).emit("update-score", lobby);
      lobby.answersCount = 0;
      lobby.users.forEach((u) => (u.currentScore = 0));
    }
  });
  socket.on("next-round", (lobbyName) => {
    const lobby = getLobbyFromName(lobbyName);
    lobby.currentRound++;
    if (lobby.currentRound > lobby.totalRounds) {
      lobby.users.sort((a, b) => b.totalScore - a.totalScore);
      io.to(lobby.name).emit("game-over", lobby);
    } else {
      lobby.letter = getRandomAlphabetLetter();
      lobby.prompt = getRandomPrompt();
      io.to(lobby.name).emit("next-round", lobby);
    }
  });
  socket.on("end-game", (lobbyName) => {
    const lobby = getLobbyFromName(lobbyName);
    lobby.inGame = false;
    io.to(lobbyName).emit("end-game", lobbyName);
    io.emit("lobby-ended-game", lobbiesArr);
  });
  socket.on("leave-room", (lobbyName) => {
    socket.leave(lobbyName);
  });
  socket.on("disconnect", () => {
    removeCurrentUserFromUsers();
    removeUserFromAllLobbies();
    io.emit("user-disconnected", usersArr, lobbiesArr);
  });

  function getLobbyFromName(lobbyName) {
    return lobbiesArr.find((l) => l.name === lobbyName);
  }

  function removeCurrentUserFromUsers() {
    usersArr.forEach((user, i) => {
      if (user.id === socket.id) usersArr.splice(i, 1);
    });
  }

  function removeUserFromAllLobbies() {
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

  function removeUserFromLobby(lobbyName) {
    const lobby = getLobbyFromName(lobbyName);
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
