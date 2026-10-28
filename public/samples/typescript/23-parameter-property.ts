class Point {
  mirror: number;
  constructor(public value: number) {
    this.mirror = value;
    this.value = 2;
  }
}
const value = new Point(1);
