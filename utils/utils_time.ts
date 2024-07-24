export class TimeCalculate {
  static getDate(t: string): Date | undefined {
    if (this.isValidFormat(t)) return new Date(t);
    else return undefined;
  }

  static differ(t1: string, t2: string): number {
    const date1 = new Date(t1);
    const date2 = new Date(t2);

    return Math.round((date1.getTime() - date2.getTime()) / 1000);
  }

  static isValidFormat(dateTimeStr: string): boolean {
    // ISO 8601日期时间格式的正则表达式
    const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
    return regex.test(dateTimeStr);
  }

  static isBetween(t: string, t1: string, t2: string) {
    // t1 < t2
    if (this.differ(t2, t1) === 0 || this.differ(t, t1) === 0) return 1;
    if (
      this.differ(t2, t1) < 0 ||
      this.differ(t, t1) < 0 ||
      this.differ(t, t2) > 0
    )
      return -1;

    return this.differ(t, t1) / this.differ(t2, t1);
  }

  static addSecondsToDate(dateString: string, secondsToAdd: number) {
    const date = new Date(dateString);
    // 获取当前时间的毫秒数
    const currentTime = date.getTime();

    // 将秒转换为毫秒并添加到当前时间的毫秒数上
    const newTime = currentTime + secondsToAdd * 1000;

    // 创建一个新的Date对象用于新的时间
    const newDate = new Date(newTime);

    return newDate.toISOString();
  }
}
