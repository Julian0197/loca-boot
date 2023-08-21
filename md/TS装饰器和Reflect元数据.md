## TS 装饰器

- 装饰器是一种方法，可以扩展类或类成员
- TS 装饰器目前只能在 `类` 或 `类成员`上使用，通过`@`语法。

### 装饰器分类

#### 类装饰器

```ts
declare type ClassDecorator = <TFunction extends Function>(
  target: TFunction
) => TFunction | void;
```

类装饰器是接收一个参数的函数，该参数就是被装饰的类自己。

通过 Animal 装饰器给装饰的对象添加一个 eat 方法。

```ts
function Animal(target: any) {
  console.log(target); // target就是Dog
  target.prototype.eat = function () {
    console.log("start eating");
  };
}

@Animal
class Dog {}

const dog = new Dog();
dog.eat(); // start eating
```

如果要给 Animal 指定吃什么？

```ts
funciton Animal(food: string) {
  return function(target: any) {
    target.prototype.eat = function() {
      console.log('start eating' + food)
    }
  }
}
```

装饰器如果要接受我们自定义参数，定义一个函数接受自定义参数，然后返回标准的装饰器即可，这就是 **装饰器工厂模式**

#### 方法装饰器

```ts
declare type MethodDecorator = <T>(
  target: Object,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<T>
) => TypedPropertyDescriptor<T> | void;
```

方法装饰器接受三个参数，可以返回一个属性描述符 `PropertyDescriptor`，也可以不返回。

- 参数 1：类的原型 （prototype）
- 参数 2：方法名
- 参数 3：被装饰方法的参数的属性描述符

通过 Type 装饰器来让 Dog 吃指定的东西。

```ts
class Dog {
  @Type("bone")
  eat() {
    console.log("i want to eat");
  }
}

function Type(type: string) {
  return function (
    target: any,
    property: string,
    descriptor: PropertyDescriptor
  ) {
    const oldCb = descriptor.value; //该方法的原始值 (function)
    descriptor.value = function () {
      // 修改装饰的方法为一个新的方法console.log("having "+type);
      oldCb.call(this); //调用原函数
      console.log(type); //hook逻辑
    };
  };
}

const dog = new Dog();
dog.eat(); // 1.i want to eat  2.bone
```

#### 属性装饰器

```ts
declare type PropertyDecorator = (
  target: Object,
  propertyKey: string | symbol
) => void;
```

属性装饰器是接收二个参数的函数。

- 参数一： 是类的原型（prototype）
- 参数二： 是表示属性名

通过 Readonly 让 Dog 的 name 属性不可变更(只读):

```ts
class Dog {
  @Readonly
  name = "狗";
}

function Readonly(target: any, property: string) {
  Object.defineProperty(target.constructor, property, { writable: false });
}

const dog = new Dog();
dog.name = "猫"; //报错，name不可修改
```

#### 参数装饰器

```ts
declare type ParameterDecorator = (
  target: Object,
  propertyKey: string | symbol,
  parameterIndex: number
) => void;
```

参数装饰器是接收三个参数的函数。

- 参数一： 是类的原型(prototype)
- 参数二： 是表示属性/方法名,
- 参数三： 表示该参数的索引(第几个)

通过 Bone 装饰器来让 Dog 的 eat 方法的参数强行变成 bone

```ts
class Dog {
  eat(@Bone some: any) {
    console.log("i want to eat " + some);
  }
}

function Bone(target: any, property: string, parameterIndex: number) {
  const oldCb = target[property]; // 获取该方法的原始值
  target[property] = function (...args: any[]) {
    // 修改装饰的方法为一个新的方法
    args[parameterIndex] = "shit"; //把指定位置参数强行转成shit
    return oldCb.apply(this, args); //调用原函数
  };
}

const dog = new Dog();
dog.eat("meat"); // 1. i want to eat bone
```

### 装饰器执行顺序

- 装饰器工厂函数形式：从上向下依次对装饰器工厂函数求值获得装饰器函数，然后再会从下向上执行。
- 普通装饰器函数：从下向上执行

```ts
function Thin() {
  console.log("进入Thin装饰器");
  return function (target: any) {
    console.log("执行Thin装饰器");
  };
}

function Beautiful() {
  console.log("进入Beautiful装饰器");
  return function (target: any) {
    console.log("执行Beautiful装饰器");
  };
}

@Thin()
@Beautiful()
class Girl {}

// 进入Thin装饰器
// 进入Beautiful装饰器
// 执行Beautiful装饰器
// 执行Thin装饰器
```

为什么 Beautiful 装饰器先执行？观察编译结果：

```js
var Girl = /** @class */ (function () {
  function Girl() {}
  Girl = __decorate([Thin(), Beautiful()], Girl);
  return Girl;
})();
```

- 实际在执行 \_\_decorate 之前会先从上到下先执行 Thin()/Beautiful()装饰器工厂函数以获得装饰器函数。
- 但是最终执行装饰器函数时候是从下向上先执行 Beautiful 装饰器，再执行 Thin 装饰器。

#### 不同类型装饰器

```ts
//类装饰器
function Thin(target: any) {
  console.log("执行Thin装饰器");
}
//方法装饰器
function Dance(target: any, property: string, descriptor: PropertyDescriptor) {
  console.log("执行Dance装饰器");
}
//属性装饰器
function Age(target: any, property: string) {
  console.log("执行Age装饰器");
}
//参数装饰器
function Jazz(target: any, property: string, parameterIndex: number) {
  console.log("执行Jazz方法参数装饰器");
}

@Thin
class Girl {
  @Age
  age = 20;

  @Dance
  dance(@Jazz type: string) {}
}

// 执行Age装饰器
// 执行Jazz方法参数装饰器
// 执行Dance装饰器
// 执行Thin装饰器
```

结论：

- 属性和方法会按照书写顺序从上向下先执行
- 如果是方法装饰器中有参数装饰器，会优先执行参数装饰器，然后再执行对应方法装饰器
- 最后执行类装饰器

#### `__decorate` 总结

- 判断 this 中有没有`__decorate`是否被定义，被定义直接使用；未定义，则定义一个能接收 4 个参数的函数，分别是`decorators`函数数组、`target`所装饰类的构造函数或类的原型对象、`key`所装饰类成员的名字、`desc`所装饰类成员的描述符；

- 定义一个变量`c`存储运行时实际传入`__decorate`函数的参数个数；

- 定义一个变量`r`，`r`中存储的内容根据实际传入`__decorate`函数的参数个数不同而不同：

  a. 传入 2 个时，`r`为类的构造函数或类的原型对象；

  b. 传入 4 个时，`r`根据`desc`是否为`null`，是则存储类成员的描述符（**访问器装饰器**、**方法装饰器**），否则为`undefined`（**属性装饰器** ）；

- 定义一个未初始化变量`d`；
- 判断是否存在`Reflect.decorate`，若存在，则直接调用该方法。否则执行下面的 else
- **这一步是该函数的核心**。从后向前遍历`decorators`装饰器函数数组，并在每次遍历中将遍历到的函数赋值给变量`d`。若 d 不为空，则根据运行时实际传入`__decorate`函数的参数个数进入不同的分支：

  a. **传入 2 个时（<3， 类装饰器）**，将`r`中存储的类的构造函数或类的原型对象做为唯一参数传入`d`中并调用。

  b. **传入 4 个时（>3，属性装饰器、访问器装饰器、方法装饰器 ）**，将`target`类的构造函数或类的原型对象、`key`装饰的类成员的名字以及 `r`类成员的描述符或`undefined`传入`d`中并调用。

  c. 传入 3 个时（目前并不存在这种情况，可能是属性装饰器的兼容实现），将`target`类的构造函数或类的原型对象、`key`装饰的类成员的名字传入`d`中并调用。

  最后，重新赋值`r`为函数`d`运行后的返回值（若有）或者`r`本身（`d`无返回值）；

- 若实际传入`__decorate`函数的参数为 4 个且`r`存在，那我们将装饰器所装饰目标的值替换为`r`。
- 最后返回 r

```ts
var __decorate =
  // 避免重复
  (this && this.__decorate) ||
  function (decorators, target, key, desc) {
    // 参数长度
    var c = arguments.length,
      // 本例属性装饰器，r为undefined，没有描述符
      r =
        c < 3
          ? target
          : desc === null
          ? (desc = Object.getOwnPropertyDescriptor(target, key))
          : desc,
      d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
      r = Reflect.decorate(decorators, target, key, desc);
    // 从后向前遍历，属性装饰器会执行d(target, key, r)
    else
      for (var i = decorators.length - 1; i >= 0; i--)
        if ((d = decorators[i]))
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  };
```

注：

1. `decorators`装饰器函数数组是**倒序遍历**并调用，因此装饰器的执行顺序是从靠近被装饰者的装饰器开始依次向上执行；
2. 装饰器函数执行后中若存在返回值，则返回值会通过`Object.defineProperty(target, key, r)`替代被装饰者的值；
3. **装饰器会紧跟在类声明后执行，并非实例化后执行；**

### reflect-metadata

Reflect Metadata 同样也是 ES7 的一个提案，用于在运行时访问和操作装饰器的元数据。它提供了一组对元数据进行修改、查询、定义的 API，可以读取和写入装饰器相关的元数据信息，比如方法的参数类型，参数个数等等，常用于解决控制反转，依赖注入。

安装 reflect-metadata 后，在顶部导入 `import "reflect-metadata;`。并且注意在`tsconfig`开启元数据。

#### 获取内置元数据

使用装饰器修饰的时候，会自动添加一下元数据。

- `Reflect.getMetadata("design:type",...)` 获取属性类型
- `Reflect.getMetadata("design:paramtypes",...)` 获取方法参数列表和类型
- `Reflect.getMetadata("design:returntype",...)` 获取方法返回类型

```ts
//属性装饰器
function Age(target: any, property: string) {
  const type = Reflect.getMetadata("design:type", target, property);
  console.log(type); //[Function: Number]
}
//方法装饰器
function Dance(target: any, property: string, descriptor: PropertyDescriptor) {
  const type = Reflect.getMetadata("design:type", target, property);
  console.log(type); //[Function: Function]
  const paramtypes = Reflect.getMetadata("design:paramtypes", target, property);
  console.log(paramtypes); //[ [Function: String] ]
  const returntype = Reflect.getMetadata("design:returntype", target, property);
  console.log(returntype); //[Function: Boolean]
}
class Girl {
  @Age
  age: number = 20;

  @Dance
  dance(type: string): boolean {
    return true;
  }
}
```

#### 自定义元数据

`Reflect.metadata` 是一个装饰器，可以直接`@Reflect.metadata(key, value)`形式来给对应的类/方法/属性添加一些自定义的元数据。

~~~ts
@Reflect.metadata('cls-meta', '刘亦菲')
class Girl {
    @Reflect.metadata('method-meta', '跳舞')
    public dance() {
        return 'i am dancing';
    }
}
console.log(Reflect.getMetadata('cls-meta', Girl));//刘亦菲
console.log(Reflect.getMetadata('method-meta', new Girl(), 'dance')); //跳舞
~~~

也可以在函数中通 Reflect.defineMetadata给对应的类/方法/属性添加一些自定义的元数据

~~~ts
//类装饰器
function Thin(target: any) {
    Reflect.defineMetadata('cls-meta', 'i am thin', target);
}
//方法装饰器
function Dance(target: any, property: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata('method-meta', 'i can dance', target,property);
}
@Thin
class Girl {
    @Dance
    dance(type:string):boolean {
        return true;
    }
}
console.log(Reflect.getMetadata('cls-meta', Girl)); // 'i am  thin'
~~~