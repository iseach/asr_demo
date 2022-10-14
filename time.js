const time = {
  timer: null,
  second: 0,

  start() {
    this.timer = setInterval(() => {
      this.second++;
      let h = Math.floor(this.second / (60 * 60)).toString().padStart(2, '0');
      let m = (Math.floor(this.second / 60) - 60 * h).toString().padStart(2, '0');
      let s = (this.second % 60).toString().padStart(2, '0');
      document.querySelector('#timer').innerHTML = `${h}:${m}:${s}`;
    }, 1000);
  },

  stop() {
    clearInterval(this.timer);
    this.second = 0;
    document.querySelector('#timer').innerHTML = `00:00:00`;
    this.timer = null;
  },

  init() {
    this.second = 0;
    document.querySelector('#timer').innerHTML = `00:00:00`;
  }
};