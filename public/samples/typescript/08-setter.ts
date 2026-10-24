const trace: string[] = [];
class Setters {
  set first(value: number) { trace.push("first:" + value); }
  set second(value: number) { trace.push("second:" + value); }
  constructor() {
    this.first = 1;
    this.second = 2;
  }
}
const value = new Setters();
