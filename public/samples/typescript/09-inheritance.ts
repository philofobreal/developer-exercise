class Base {
  value = 1;
}
class Derived extends Base {
  extra = this.value + 1;
  constructor() {
    super();
    this.value = 3;
  }
}
const value = new Derived();
