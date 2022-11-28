/* eslint-disable no-unused-vars */
const config = require('./config')
const { app, BrowserWindow, ipcMain } = require('electron')
const Koa = require('koa')
const Router = require('koa-router')
const bodyParser = require('koa-bodyparser')
const utils = require('./utils')
const path = require('path')
const cors = require('@koa/cors')

/* Robot data
   架構為 key<accout> : value<存入elk之資料>
*/
const robotData = {}

// ipc 接收robot message存至 robotData
ipcMain.on('robot-error', (event, arg) => {
  if ('errorType' in arg) {
    if (arg.errorType === 'socketError') {
      // 如果前端websocket斷線 將換壓上life type 3 表示連線失敗
      console.error(`robot[${arg.account}] socket error: ${arg.message}`)
      robotData[arg.account].lifeType = utils.lifeType.connectFail
    }
    if (arg.errorType === 'accountError') {
      console.error(`robot[${arg.account}] account instance is null`)
    }
    if (arg.errorType === 'betFail') {
      console.error(
        `robot[${arg.account}] bet fail: ${arg.message}, code: ${arg.code}`
      )
    }
    return
  }
  console.error(
    `robot[${arg.account}]: error: ${arg.error.message} stack: ${arg.error.stack}`
  )
})

ipcMain.on('robot-init', (event, arg) => {
  robotData[arg.account] = arg
})

ipcMain.on('robot-update', (event, arg) => {
  const account = arg.account
  for (const [key, value] of Object.entries(arg)) {
    if (!robotData[account]) {
      return
    }
    if (key === 'bet') {
      robotData[account][key] += value
      continue
    }
    robotData[account][key] = value
  }
})

const koa = new Koa()
koa.use(cors())
const router = new Router()

/* Array of Robot Instance & testNo Map
   架構為 key<testNo>: value< Array of robot instance>
   主要功能為存robot實例
*/
const robotList = new Map()

/* Robot Number & testNo Map
   架構為 key<testNo>: value< Number of robot>
   存測試案例的機器人數量 為何不用robotList的length是因為以防機器人實際數量可能沒開成功
*/
const robotAmountList = new Map()

async function createWindow (query) {
  // Create the robot window.
  try {
    let robot
    if (process.env.NODE_ENV === 'test') {
      // npm run debug 執行debug模式
      robot = new BrowserWindow({
        width: 500,
        height: 500,
        webPreferences: {
          preload: path.join(app.getAppPath(), 'preload.js')
        }
      })
      // robot.webContents.openDevTools();
    } else {
      robot = new BrowserWindow({
        show: false,
        webPreferences: {
          preload: path.join(app.getAppPath(), 'preload.js')
        }
      })
    }
    query.testNo = query.testNo ?? 'default'
    await robot.loadFile('robotClient/index.html', { query })

    robot.on('close', async () => {
      delete robotData[query.robotName]
      console.log(`${query.robotName} is close`)
    })

    // // 更新robotList
    // if (!robotList.has(testNo)) {
    //     robotList.set(testNo, [query]);
    // } else {
    //     const testNoRobots = robotList.get(testNo);
    //     testNoRobots.push(query);
    //     // 緩衝創建機器人
    //     await utils.delay(testNoRobots.length > 50 ? testNoRobots.length * 2 : 100);
    // }
  } catch (error) {
    console.error(`create robot error: ${error}`)
  }
}

// 對所有機器人名稱對應 創建機器人Window
async function createRobots (robotNames, postData) {
  try {
    for (const robotName of robotNames) {
      const robotParameters = {
        robotName,
        round: postData.round,
        testNo: postData.testNo
      }
      if (process.env.NODE_ENV === 'test') {
        console.log(`create Robot ${robotParameters.account}`)
      }
      await createWindow(robotParameters)
    }
  } catch (error) {
    console.error('創建機器人 error: ', error)
  }
}

async function main () {
  // Main consisting window
  const mainWin = new BrowserWindow({ show: false })

  // KOA Setting
  koa.use(bodyParser())
  router
    .get('/', (ctx) => {
      ctx.body = 'Robot Server is active'
    })
    .get('/robot/all/name', (ctx) => {
      if (robotData.size === 0) {
        ctx.body = []
        return
      }
      const response = Object.keys(robotData)

      ctx.body = response
    })
    .post('/is-ready', (ctx) => {
      // 從config server過來判斷 使否在限制內可創建機器人
      const totalAmount =
        robotAmountList.size > 0
          ? [...robotAmountList.values()].reduce((arr, cur) => arr + cur)
          : 0
      let isReady = false
      let availableNumber = config.max_robots - totalAmount
      const requestRobotNumber = Number(ctx.request.body.robotAmount)
      if (totalAmount + requestRobotNumber <= config.max_robots) {
        isReady = true
        availableNumber -= requestRobotNumber
      }
      ctx.body = {
        isReady,
        availableNumber,
        totalNumber: config.max_robots
      }
    })
    .post('/robot/:number', async (ctx) => {
      try {
        const totalAmount =
          robotAmountList.size > 0
            ? [...robotAmountList.values()].reduce((arr, cur) => arr + cur)
            : 0
        robotAmountList.set(ctx.request.body.testNo, +ctx.params.number)
        const excuteTimes = +ctx.params.number || 1
        if (excuteTimes + totalAmount > config.max_robots) {
          throw new Error('request of robots exceeds the maximum limit')
        }

        // 產生robotNames 並開始創建機器人
        const robotNames =
          excuteTimes === 1
            ? [ctx.request.body.account]
            : [...Array(excuteTimes).keys()].map(
                (el) =>
                  ctx.request.body.account + String(el + 1).padStart(3, '0')
              )
        ctx.status = 202
        ctx.body = 'Robots are being created!'
        createRobots(robotNames, ctx.request.body)
      } catch (error) {
        ctx.status = 400
        ctx.body = {
          message: error.message
        }
        ctx.app.emit('error', error, ctx)
      }
    })
    .delete('/robot/:testNo', async (ctx) => {
      if (robotList.size === 0) {
        ctx.body = 'there is no robot running.'
        return
      }
      if (ctx.params.testNo) {
        // 如果輸入參數為all 將刪除所有
        const robots =
          ctx.params.testNo === 'all'
            ? [...robotList.values()].flat(1)
            : robotList.get(ctx.params.testNo)
        if (!robots || robots.length === 0) {
          ctx.body = `${ctx.params.testNo} has no robot running.`
          return
        }
        robots.forEach((robot, index, object) => {
          if ('close' in robot) {
            if (robotData[robot.name] !== 'NA') {
              try {
                robot.close()
                robotData[robot.name].lifeType = utils.lifeType.userStop
              } catch (error) {
                console.error(
                  `delete robot: close robot error: ${error.message}`
                )
              }
            }
          }
        })
        await utils.delay(500)
        ctx.body = `delete testNo: ${ctx.params.testNo} robots, done`
        return
      }
      ctx.status = 400
      ctx.body = 'please input testNo'
      ctx.app.emit('error', ctx)
    })
    .get('/robot/all/detail', async (ctx) => {
      // front-end data
      try {
        const res = Object.values(robotData)

        ctx.body = res
      } catch (error) {
        console.error('getRobotData update error', error)
      }
    })
  koa.use(router.routes())
  koa.timeout = 5 * 60 * 1000 // Timeout setting
  koa.listen(config.port, () => {
    console.log('robot client sever listening on Port', config.port)
  })
}

app.on('ready', main)
