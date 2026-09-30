declare module "pg" {
  export class Pool {
    constructor(config?: any);
    query(text: string, values?: any[]): Promise<any>;
    on(event: string, listener: (...args: any[]) => void): this;
    end(): Promise<void>;
  }
}
