class PrivateOrder {
  #first = 1;
  #second = this.#first + 1;
  read(): number { return this.#second; }
}
const value = new PrivateOrder();
