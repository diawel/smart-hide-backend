import WebSocket, { WebSocketServer } from 'ws'

const server = new WebSocketServer({ port: 5050 })

type Player = {
  name: string
  state: 'preparing' | 'ready' | 'disconnected'
  score: number
  hideCount: number
}

type Game = {
  state: 'preparing' | 'ready' | 'ongoing' | 'finished'
  players: {
    [uuid: string]: Player
  }
  seek?: {
    image: {
      src: string
      filter: number
    }
    target: string
    since: number
  }
  hide?: {
    player: string
    since: number
  }
}

const gameTable: {
  [code: string]: Game
} = {}
const connectionTable: {
  [uuid: string]: {
    code: string
    socket: WebSocket
  }
} = {}

const updateGame = (code: string) => {
  for (const uuid in connectionTable) {
    if (connectionTable[uuid].code != code) continue
    connectionTable[uuid].socket.send(
      JSON.stringify({ uuid, game: gameTable[code] })
    )
  }
}

server.on('connection', (socket) => {
  socket.on('message', (message) => {
    const recieve: {
      uuid: string
      code: string
      setPlayer?: { [uuid: string]: Player }
      setGame?: Game
    } = JSON.parse(message.toString())
    if (!connectionTable[recieve.uuid])
      connectionTable[recieve.uuid] = {
        code: recieve.code,
        socket: socket,
      }

    if (!gameTable[recieve.code]) {
      gameTable[recieve.code] = {
        state: 'preparing',
        players: {},
      }
    }

    if (recieve.setPlayer)
      for (const uuid in recieve.setPlayer)
        gameTable[recieve.code].players[uuid] = recieve.setPlayer[uuid]

    if (recieve.setGame) {
      const currentPlayers = { ...gameTable[recieve.code].players }
      gameTable[recieve.code] = recieve.setGame
      gameTable[recieve.code].players = currentPlayers
    }

    updateGame(recieve.code)
  })

  socket.on('close', () => {
    for (const uuid in connectionTable) {
      if (
        connectionTable[uuid].socket == socket &&
        gameTable[connectionTable[uuid].code]
      ) {
        gameTable[connectionTable[uuid].code].players[uuid].state =
          'disconnected'
        const players = Object.keys(
          gameTable[connectionTable[uuid].code].players
        ).filter(
          (player) =>
            gameTable[connectionTable[uuid].code].players[player].state !=
            'disconnected'
        ).length
        if (players == 0) delete gameTable[connectionTable[uuid].code]
        updateGame(connectionTable[uuid].code)
        delete connectionTable[uuid]
        break
      }
    }
  })
})
