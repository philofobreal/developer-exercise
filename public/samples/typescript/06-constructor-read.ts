class Writing {
  declare first: number;
  declare second: number;
  constructor(first: number) {
    this.first = first;
    this.second = this.first + 1;
  }
}
const value = new Writing(3);
