import { IColumnDefined, IDataModel } from "../decorator";
import { dynamicModelBase } from "./dynamicModelBase";

type SnakeCase<T> = T extends `${infer F}${infer R}`
  ? F extends Capitalize<F>
    ? `_${Uncapitalize<F>}${SnakeCase<R>}`
    : `${F}${SnakeCase<R>}`
  : T;

type ExcludeFunction<T> = {
  [K in keyof T]: T[K] extends Function ? never : T[K];
}

type ModelSnakeCase<T> = {
  [K in keyof ExcludeFunction<T> as SnakeCase<K>]?: T[K];
};
// 让实例对象的属性变成可选的
type Model<T> = {
  [K in keyof ExcludeFunction<T>]?: T[K];
};


export function createModel<T>(
  dto: ModelSnakeCase<T> & Model<T>,
  Model: new (dto: any) => T,
  params?: IDataModel
) {
  return new (Model as any)(dto, params) as T;
}

export function createDynamicModel(
  dto: any,
  columnObj: {
    [key: string]: IColumnDefined;
  },
  params?: IDataModel
) {
  return new (dynamicModelBase(columnObj as any, params))(dto);
}
