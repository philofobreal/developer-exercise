class Parameters {
  mirror: number;
  constructor(public value: number) {
    this.mirror = value;
    this.value = 2;
  }
}
const value = new Parameters(1);
