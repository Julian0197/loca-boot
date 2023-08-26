## createModel 详解

### 背景

在使用`ModelBase`的时候，我们对于`constructor`的参数类型是没有限制，目的是为了兼容后端数据，后端传入的数据要经过`ServiceResponse`类封装，会传入一些前端用不到的数据，我们不好做类型校验，放宽传入的 dto 类型为`any`。

但是在实际开发中，我们希望能够对`new Model(dto)`的参数类型做校验，可以有效避免字段写错的低级错误。比如：

```ts
class Consumer extends ModelBase {
  @Column()
  userName: string;
}

const consumer1 = new Consumer({ userName: 123 }); // 正确
const consumer2 = new Consumer({ useName: 123 }); // 错误传入useName，但是不会报错
```

### 通过 ts 的类型体操实现

#### `createModel<T>`

```ts
export function createModel<T>(
  dto: ModelSnakeCase<T> & Model<T>,
  Model: new (dto: any) => T,
  params?: IDataModel
) {
  return new (Model as any)(dto, params) as any as T;
}
```

- `createModel`接受三个参数，第一个参数是`new Model(dto)`时传入的`dto`，第二个参数是构造函数`Model`，第三个参数是可选配置项。
- `new Model`后会调用`ModelBase`的构造函数，根据传入数据和`Model`声明时的元数据，生成`Model`实例。
- 利用 TS 的泛型`T`，去判断返回实例的类型是否和传入的`dto`类型满足特定的关系，校验传入数据的类型是否正确。
  - dto的类型必须是`ModelSnakeCase<T>`和`Model<T>`的交集
  - `Model<T>`是最后返回实例的数据类型，包含所有可枚举属性，剔除了函数类型，并且所有属性都是可选的。
  - `ModelSnakeCase<T>`将`Model<T>`中的属性名转换为下划线命名，比如`userName`转换为`user_name`，`User`转换为`_user`。

**tips：**：
1. 使用`Model<T>`限制dto的目的在于，限制传入的类型必须是`Model<T>`的子集，而不是`Model<T>`的超集，因为`Model<T>`中的属性都是可选的，如果传入的类型是`Model<T>`的超集，那么就会出现传入的类型中包含`Model<T>`中没有的属性，导致校验失败。
2. 使用`SnakeCase<T>`限制dto的目的在于，保证传入的数据既可以是驼峰命名，也可以是下划线命名，比如`userName`和`user_name`都可以传入，但是最终都会转换为`user_name`。

#### `ExcludeFunction<T>`

```ts
type ExcludeFunction<T> = {
  [K in keyof T]: T[K] extends Function ? never : T[K];
};
```

- `ExcludeFunction<T>`返回一个新类型，剔除 T 中的函数类型，只保留属性类型。

#### `Model<T>`

```ts
type Model<T> = {
  [K in keyof ExcludeFunction<T>]?: T[K];
};
```

- 实例化的 Model 拥有声明时候定义的所有属性，即使没有传入，也会初始化为`undefined`
- Model 干了两件事：
  1. 生成一个新类型，剔除原本对象类型中值为函数的类型，因为我们只需要校验属性
  2. 由于生成的实例类型包含所有声明的属性，而传入的 dto 可能不包含所有属性，所以需要将所有属性变为可选属性

#### `SnakeCase<T>`

```ts
type SnakeCase<T> = T extends `${infer F}${infer R}`
  ? F extends Capitalize<F>
    ? `_${Uncapitalize<F>}${SnakeCase<R>}`
    : `${F}${SnakeCase<R>}`
  : T;
```

- `SnakeCase<T>`是一个递归的条件类型，用于将驼峰命名转换为下划线命名，比如`userName`转换为`user_name`，`User`转换为`_user`。
- 先检查字符串 T 是否符合 `${infer F}${infer R}` 的模式，其中 `${infer F}` 表示字符串的第一个字符，`${infer R}` 表示剩余的字符。
- 然后，它检查第一个字符 F 是否为大写字母（通过 `F extends Capitalize<F>`）。如果是大写字母，则在它的前面添加下划线，并将其转换为小写字母（通过 `_${Uncapitalize<F>}`）
- 然后，它递归地对剩余的字符 R 进行相同的转换（通过 `${SnakeCase<R>}`）。

#### `ModelSnakeCase<T>`

```ts
type ModelSnakeCase<T> = {
  [K in keyof ExcludeFunction<T> as SnakeCase<K>]?: T[K];
};
```

- `ModelSnakeCase<T>`是一个映射类型，用于将`Model<T>`中的属性名转换为下划线命名，比如`userName`转换为`user_name`，`User`转换为`_user`。


至此，createModel的功能讲解完毕。