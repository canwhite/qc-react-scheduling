const queue = []
// react中为 5ms，fre中为16ms 是多少目前看无所谓
const threshold = 1000 / 60
const unit = []  //这里边存储flushwork
let deadline  = 0


// 2.schedule收集 flushWork 并触发一个宏任务
// 这里的cb实际上就是下边的flushWork
// 里边主要是flush和递归调用

 const schedule = (cb) => unit.push(cb) === 1 && postMessage()

 // flushwork
const flushWork = () => {
  const currentTime = getTime()
  deadline = currentTime + threshold
  flush(currentTime) && schedule(flushWork)//如果又job就会继续开新线程执行
}



//1.对外暴露的入口，进行任务收集
//这里第一次调用schedule,内部是把flushWork给异步线程

 const scheduleWork = (callback, time) => {
  const job = {
    callback,
    time,
  }
  //任务封装
  queue.push(job)
  schedule(flushWork) 
}



// 不兼容 MessageChannel 则使用 setTimeout
const postMessage = (() => {
  //3.schedule会给unit添加flushWork，并且执行flushwork
  //flushWork里边主要计算当前事件和deadline
  //执行flush(currentTime)用以清空job
  //schedule(flushWork)重新为flush提供线程
  const cb = () => unit.splice(0, unit.length).forEach((c) => c())
  
  //这里相当于为执行flush提供新的线程
  if (typeof MessageChannel !== 'undefined') {
    const { port1, port2 } = new MessageChannel()
    port1.onmessage = cb
    return () => port2.postMessage(null)
  }
  return () => setTimeout(cb)
})()



//PS：黄字标出的内容是为了模拟requestIdleCallBack的能力,为什么不直接用Idle呢？是有的浏览器不支持吗
//why，看微信图和我保存的那个链接



// 这里执行传入的任务
const flush = (initTime) => {
  let currentTime = initTime
  let job = peek(queue)
  while (job) {

    const timeout = job.time + 3000 <= currentTime
    // 超过了 16 ms 立即终止 交还控制权给浏览器一下
    if (!timeout && shouldYield()) break


    const callback = job.callback
    job.callback = null
    // 这里的 next 存在则意味着fiber的中断
    // 即fiber中断，继续将这个任务添加于自身
    // 这样保证了reconcileWork继续执行
    const next = callback(timeout)
    if (next) {
      job.callback = next
    } else {
      queue.shift()//shift把数组的第一个元素从数组中删除，并返回数组的值
    }

    job = peek(queue)
    currentTime = getTime()
  }
  return !!job
}

// 是否过期
 const shouldYield = () => {
  return getTime() >= deadline
}
 const getTime = () => performance.now()
// 最短剩余时间优先执行（react根据优先级进行的过期时间排序）
const peek = (queue) => {
  queue.sort((a, b) => a.time - b.time)
  return queue[0]
}