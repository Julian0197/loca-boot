# ModelBase源码有感

## 初衷

一行代码解决前端处理数据的痛苦：

+ 后端数据规范是下划线风格，需要前端转化为驼峰
+ 代码的静态类型检查需求，基于typescript
+ vue2的响应式丢失问题，如果不提前定义好一个对象的key，这个对象将不是响应式的（除非通过`vue.set`）,如果提前定义好key（一个model可能几十个key），一个对象又可能在多个页面出现，存在大量重复劳动（vue3 的composition api倒可以解决这个问题）
+ 提交数据有时候需要全量提交，有时候需要增量提交；改了很多数据，想恢复到默认状态；对数据的一些初始化操作等等，常用的功能都封装在ModelBase里面

## 补充

### vite 集成modelbase

vite依赖esbuild，而esbuild最大特性是速度快，所以也不愿支持完整的typescript type checker。这将导致 vite 不能和reflect-metadata一起使用，像 typeorm和nestjs都不大好结合vite

解决方案：`https://kaokei.com/pages/b11568/#walkaround`，`https://github.com/evanw/esbuild/issues/915#issuecomment-791904154`

另外启用modelbase利用reflect-metadata，需要再tsconfig.json设置：
~~~json
"compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
}
~~~

### ts编译的 useDefineForClassFields 标记与 declare 属性修饰符

当`tsconfig.json`中的`target` 设置为`ESNext` 或者`ES2022`时，属性修饰器会失效。因为在新的版本下`useDefineForClassFields`这个属性默认设置为`true`

由于我们创建对象都是通过new A({a: 1})去赋值，如果不进行`define`，则无法通过modelbase进行赋值。需要关闭useDefineForClassFields设置为false，在`tsconfig.json`里面启用如下配置：
~~~json
"compilerOptions": {
    "useDefineForClassFields": false,
}
~~~

如果配置了 `useDefineForClassFields: true`，会使用 `Object.defineProperty` 来初始化声明，对于class的继承会出现值`undefined`的问题。
下面的例子中，`Consumer`继承了`ModelBase`。我们通常会在ModelBase的构造函数中去根据`new Consumer(dto)`时传入的`dto`对象去结合`Consumer`类声明时定义的元数据去做一个初始化。

~~~ts
class ModelBase {
  constructor(dto： any) {
    this.userName = dto?.userName;
  }
}

class Consumer extends ModelBase {
  // 一般是这么写的 
  // @Column() 
  public userName: string
}
~~~

编译结果：可以看到在`Consumer`的构造函数中通过`super()`执行完 `ModelBase` 的构造函数后，会执行`Object.defineProperty()`，并通过设置`value: void 0` 初始化为`undefined`导致赋值失败。

~~~js
"use strict";
class ModelBase {
    constructor(dto, any) {
        this.userName = dto === null || dto === void 0 ? void 0 : dto.userName;
    }
}
class Consumer extends ModelBase {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "userName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
    }
}
~~~

#### 设置需要被修饰的属性为declare

`declare`用于在TS中声明，告诉编译器存在这么一个对象，可以在其他地方使用声明的对象。**编译器不会将此语句编译为js**，declare关键字用于 TypeScript 声明文件 ( .d.ts )。

## 基本概念

+ ModelBase实例：自定义class继承ModelBase后，通过new创建的实例，该实例具有ModelBase原型所有的方法。

+ input流向数据
  - 一般指后端返回给前端的数据，在ModelBase里面指的是new ModelBase(input)。
+ output流向数据
  - 一般指的是前端提交给后端，在ModelBase里面指的是调用getChangedData、getSerializableObject、
  - 、getCleanSerializableObject、getCleanSerializableString、getChangedDescriptor等方法获取的数据。
  - 比较理想的状态是input和output的key是一模一样，他们和ModelBase的key的关系仅仅是下划线和驼峰的关系。
+ 数据状态：目前只有一种saved状态。我们简单理解它，currentData和oldData（saved状态的值）
  - 实例创建后currentData和oldData相等。
  - 修改currentData，会造成和oldData不相等。
  - 调用saveChangedData()，currentData和oldData又相等。

+ ##### 通过metadata存储saved的值：元数据不是可枚举属性，无法通过`Object.keys`获取。

+ 处理好的元数据通过WeakMap获取，`modelColumnsMap.set(t_.constructor, columns_)`，一是为了防止重复调用逻辑每次`new`都要获取一遍元数据（存在继承的情况，这段逻辑会比较复杂），二是考虑到很多动态模型创建好后会被释放掉。而普通的`map`对象会让 `modelColumnsMap` 越来越大

---

作为一名前端实习生，在使用过ModelBase并调试源码后得到的一些感想...

涉及到以下知识点：

+ monorepo架构
+ ES6 class，原型相关，extends原理
+ ts装饰器、属性装饰器原理
+ reflect-metadata库 元数据 WeakMap

## 调试ModelBase（建议使用IDEA编辑器）

仓库名：`PE.FRONTEND.LOCA`

~~~bash
yarn
cd common
yarn pkgs boot 
~~~

源码调试时候注意要修改工作目录为common结尾

![img_v2_3f3bb792-3201-4745-be5d-ce16cf24d77g](/Users/jandon.ma/Library/Application Support/LarkShell/sdk_storage/06baee9a7891e3d39c3e618488baf667/resources/images/img_v2_3f3bb792-3201-4745-be5d-ce16cf24d77g.jpg)

### Monorepo架构

**monorepo架构：**多个项目存放在一个代码仓库，每个子项目都在packages目录下，可以独立运行。

**workspace协议：**monorepo架构的仓库中，子项目之间会引用相同的依赖，通过workspace协议配置哪些目录是monorepo项目的工作区，该工作区下的所有子项目都会共享根目录下的`node_modules`。

~~~json
// common/package.json
"workspaces": [
    "packages/boot/packages/*",
    "packages/map/packages/*",
    "packages/mfe/packages/*"
  ]
~~~

上述代码：boot、map、mfe的packages底下的所有子项目的公共依赖都存放于`common/node_modules`下。项目特有的依赖还是存放于当前子项目的`node_modules`下。

**目的：**monorepo架构为了关联多个相关的项目，项目之间存在一定依赖关系，并且对于公共依赖不会重复安装。同时联想到Vue3源码也采用了monorepo架构，每个模块具有一定联系，又可以单独运行，比如：如果用户只想使用vue的响应式能力，可以单独依赖reactive库，而不用去依赖整个vue.js，减小了包的引用体积。

## 前提知识

ModelBase的使用初衷就是通过简单的代码来处理数据，打通前后端数据的连接。

以下案例中，定义了一个Consumer类，在模型中会定义可能用到的全部属性，Consumer类不止会在一个地方用到，所以在定义模型时候要定义全。（这是为了规避vue2中的响应式丢失问题，vue2中的对象必须提前定义好key，后加入的key响应式会失效，除非通过`Vue.set()`）。但是在提交数据时，我们又希望没有使用到的数据不传给后端，这个时候会调用`getCleanSerializableObject`清除空字符、空对象和空数组，达到可序列化。

~~~js
export class Consumer extends ModelBase {
  @Column()
  public id?: number

  @Column({ trim: true })
  public userName?: string
  
  @Column({ model: ConsumerItem, autowired: true })
  public consumerList!: ConsumerItem[]
}

const p1: Consumer = ref(null)
p1.value = new Consumer({userName: 'admin'})
// p1: Consumer {id: undefined, userName: 'admin', consumerList: Array(0)}
const p1_ = p1.getCleanSerializableObject()
// p1_: {userName: 'admin'}
~~~

### ES6 class、原型

整个ModelBase是基于ES6提出的class搭建的。JS起初作为脚本语言，一开始模糊了面向对象编程的语言特性，ES6才提出了class的概念。

**为什么说是模糊了面向对象编程的特性？**

在JS中本身有"一切都是对象"的说法，虽然本身数据类型分为基本数据类型和引用数据类型，JavaScript 对一些基础的数据类型进行类型包装，使得它们拥有对象才有的一些方法，比如 toSting， valueOf。

~~~js
const s = 'model'
typeof s === 'string' // true
s.__proto__ === String.prototype // true
s instanceof String // false
~~~

**这里涉及到显示原型和隐式原型的概念：**

每一个对象都有一个原型对象，可以通过`__proto__`属性来访问。当我们访问一个对象的属性或方法时，如果这个对象本身没有这个属性或方法，JavaScript就会沿着原型链往上查找，直到找到为止。

当我们使用`new`关键字创建一个实例对象时，JavaScript会将该实例对象的`__proto__`属性指向构造函数的`prototype`属性，从而实现原型链的继承关系。

`prototype` 称为显式原型，`__proto__`称为隐式原型。实例对象的`constructor`指向构造函数；实例对象的隐式原型指向构造函数的显式原型。

~~~js
function ModelBase() {}
const consumer = new ModelBase()

console.log(consumer.constructor === Modelbase) // true
console.log(consumer.__proto__ === Modelbase.protoType) // true
~~~

**ES6的class也是基于函数和原型实现的：**

类分为静态属性/方法 和 类方法/属性。static定义的为静态方法，静态方法通过类名直接调用，类方法通过类的实例化对象调用（实际是被挂载到类的prototype上）

~~~js
class Person {
  public run() {
        console.log('111')
    }
  public static jump() {
    console.log('333')
  }
}
// 覆盖了类方法说明类方法是挂载到类的prototype上的
Person.prototype.run = function () {
    console.log('222')                                                         
}

const p = new Person()

p.run() // '222'
~~~

Person类实现的代码经过`Babel`编译后：

+ 定义了一个 `_classCallCheck` 方法，用于检测类作为构造函数的调用方式是否是通过 new 操作符进行的，如果不是则会抛出一个 TypeError 的异常。 
+ 定义了一个 `_defineProperties` 方法，用于给类的原型对象或类本身添加属性描述符。通过遍历传入的 props 数组，将每个属性描述符的 enumerable 和 configurable 属性设置为 true，同时如果属性描述符中包含 value 属性，则将 writable 属性也设置为 true。最后通过 Object.defineProperty 给目标对象添加属性描述符。
+ 定义了一个 `_createClass` 方法，用于创建类的工厂函数。这个方法接收三个参数：构造函数、原型对象属性和静态属性。通过调用 _defineProperties 方法给构造函数的原型对象添加属性描述符，同时如果有静态属性，则调用 _defineProperties 给构造函数本身添加属性描述符。最后设置构造函数的 prototype 属性为不可写，返回构造函数。

~~~js
// 检测 class 的调用方式，确保是通过 new 操作符进行调用
function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}
// 定义方法属性
function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}
// 创建 class 对象类的工厂函数
function _createClass(Constructor, protoProps, staticProps) {
  // ES6 的类方法是定义在 prototype 原型对象上的
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  // 静态方法直接挂载到类上所以类的实例无妨访问
  if (staticProps) _defineProperties(Constructor, staticProps);
  Object.defineProperty(Constructor, "prototype", { writable: false });
  return Constructor;
}

// -----------------------------------------------------
// 定义 Person 类型
var Person = /*#__PURE__*/ (function () {
  function Person() {
    // 检测 Person 作为一个类构造函数的调用方式，确保是通过 new 操作符进行调用
    _classCallCheck(this, Person);
  }

  _createClass(
    Person,
    [
      {
        key: "run",
        value: function run() {
          console.log("111");
        },
      },
    ],
    [
      {
        key: "jump",
        value: function jump() {
          console.log("333");
        },
      },
    ]
  );

  return Person;
})();
~~~

### 元数据、reflect-metadata库

**元数据：**用来描述数据的数据，比如当前类有一个属性为`userName`，对于这个属性我还有一些描述性数据，我们把他称为元数据，例：userName可以有一些元数据来表述这个属性的类型，默认值，别名等 。

`Reflect Metadata`是属于ES7的一个提案，其主要作用是在声明时去读写元数据。

TS本身虽然支持定义数据的类型等信息，但这些信息只存在于提供给TS编译器用作编译期执行静态类型检查。经过编译后的代码会成为无类型的传统JS代码。为了能够使JS具备运行时获取数据类型、代码状态、自定义内容等信息，reflect-metadata给我们提供了一系列相关方法。

官方文档：https://github.com/rbuckton/reflect-metadata

~~~js
// 还未成为标准，因此想使用reflect-metadata中的方法就需要手动引入该库，引入后相关方法会自动挂在Reflect全局对象上
import 'reflect-metadata'

class Example {
  text: string
}
// 定义一个exp接收Example实例,: Example和: string提供给TS编译器进行静态类型检查，不过这些类型信息会在编译后消失
const exp: Example = new Example()

// 注意：手动添加元数据仅为展示reflect-metadata的使用方式，实际上大部分情况下应该由编译器在编译时自动添加相关代码
// 为了在运行时也能获取exp的类型，我们手动调用defineMetadata方法为exp添加了一个key为type，value为Example的元数据
Reflect.defineMetadata('type', 'Example', exp)
// 为了在运行时也能获取text属性的类型，我们手动调用defineMetadata方法为exp的属性text添加了一个key为type，value为Example的元数据
Reflect.defineMetadata('type', 'String', exp, 'text')

// 运行时调用getMetadata方法，传入希望获取的元数据key以及目标就可以得到相关信息（这里得到了exp以及text的类型信息）
// 输出'Example' 'String'
console.log(Reflect.getMetadata('type', exp))
console.log(Reflect.getMetadata('type', exp, 'text')) 
~~~

除了defineMetadata（定义元数据）、getMetadata（获取元数据）这两个最基础的方法外，reflect-metadata还提供了hasMetadata（判断元数据是否存在）、hasOwnMetadata（判断元数据是否存在非原型链上）、getOwnMetadata（获取非原型链上元数据）、getMetadataKeys（枚举存在的元数据）、getOwnMetadataKeys（枚举存在非原型链上的元数据）、deleteMetadata（删除元数据）以及@Reflect.metadata装饰器（定义元数据）这一系列元数据操作方法。

**reflect-metadata内部结构：**

分为三层map，每一个target通过weakmap映射到一个metadataMap，metadataMap内部存储了target对象上所有键的元数据（metadata），metadata也是一个map，里面映射metadataKey => metadataValue。

~~~js
Reflect.defineMetadata(metadataKey, metadataValue, target, propertyKey);

const weakmap = new WeakMap()
const metadata = new Map()
metadata.set(metadataKey, metadataValue)
const metadataMap = new Map()
metadataMap.set(propertyKey, metadata)
weakmap.set(target, metadataMap)
~~~

WeekMap的键名所指向的对象是弱引用，垃圾回收机制不会考虑这个引用。当所引用的对象的其他引用被清除，垃圾回收机制就会释放内存。也就是说，一旦不再需要，`WeakMap` 里面的键名对象和所对应的键值对会自动消失，不用手动删除引用。

这让我联想到Vue3 的响应式原理中具有相同的处理方式，将需要响应式的对象作为`WeakMap`的键，值为一个Map；Map的key为响应式对象的key，值为一个数组，数组中数据为当前key的依赖函数。当这个对象不再被引用，那么WeakMap中收集的依赖函数啥的都会被垃圾回收。

### TS装饰器

ts装饰器是一种语法糖，本质是一个函数，能够动态地被装饰类或类成员，在这些值未定义时就进行初始化，或者在值实例化时执行一些额外代码。

你可以在 https://www.typescriptlang.org/play 查看装饰器编译后的结果，记得切换ts的版本为4.5.5。

最新的TypeScript 5.0 beta 支持：新版 ES 装饰器，详细见：https://juejin.cn/post/7194435148329254972#heading-13

#### 装饰器分类

+ 类装饰器：类装饰器表达式会在运行时当作函数被调用，类的构造函数作为其唯一的参数。
+ 方法装饰器：入参为 **类的原型对象** **属性名** 以及**属性描述符**
  + 第一个参数：如果是静态成员 => 类的构造函数，如果是实例成员 => 类的原型对象
  + 第二个参数：成员名
  + 第三个参数：方法的description（可写，可读等...）

+ 属性装饰器：类似于方法装饰器，但它的入参少了属性描述符。
+ 参数装饰器：入参首要两位与属性装饰器相同，第三个参数则是参数在当前函数参数中的**索引**。
  + 第三个参数：参数在函数参数列表的索引

TS在编译过程中会去掉原始数据类型相关的信息，将TS文件转换为传统的JS文件以供JS引擎执行。但是，一旦我们引入reflect-metadata并使用装饰器语法对一个类或其上的方法、属性、访问器或方法参数进行了装饰，那么TS在编译后就会自动为我们所装饰的对象增加一些类型相关的元数据，目前只存在以下三个键：

- **类型元数据**使用元数据键"design:type"
- **参数类型元数据**使用元数据键"design:paramtypes"
- **返回值类型元数据**使用元数据键"design:returntype"

#### 装饰器原理（属性装饰器为例）

以下面的属性装饰器为例，从编译结果来分析装饰器的原理：

~~~js
function Column(target: any, propertyKey: string) {
  console.log(target); // Person {}
  console.log("key： " + propertyKey); // key： name
}
class Person {
  @Column
  name: string;

  constructor() {
    this.name = 'user1';
  }
}
const user = new Person();
~~~

##### 主流程

属性装饰器的`__decorate`，接受4个参数。

+ 第1个参数为函数数组[自定义装饰器函数，元数据函数（用于添加类型元数据，键为design:type）]
+ 第2个参数为类的原型对象（当装饰static静态属性时应为类的构造函数）
+ 第3个参数为所装饰类成员的名字
+ 第4个参数为`undefined`（`void 0`就是`undefined`，之所以使用`void 0`是因为`undefined`可以被用户赋值改变，不安全）。

~~~js
function Column(target, propertyKey) {
  console.log(target); // Person {}
  console.log("key " + propertyKey); // key name
}
class Person {
  constructor() {
    this.name = "user1";
  }
}

__decorate(
  [Column, __metadata("design:type", String)], // Name的类型是string，定义到元数据上
  Person.prototype,
  "name",
  void 0
);
const user = new Person()
~~~

**核心：**对于本例来说，实际上属性装饰器没有描述符，只有两个参数target和key，执行`__decorate`函数相当于：

~~~js
// 1.添加被装饰属性的类型元数据到原型
Reflect.metadata("design:type", String)(Person.prototype, "name")
// 上述代码等价于
Reflect.defineMetadata("design:type", String, tPerson.prototype, "name")

// 2.执行自定义装饰器函数
Column(Person.prototype, "name")
~~~

##### `__metadata`

等价于`Reflect.metadata`

+ 先判断当前环境中也就是`this`中是否存在已定义过的`__metadata`，定义过就直接使用，否则创建函数
+ 函数中判断Reflect.metadata是否存在并为函数（需要手动导入reflext-metadata库），如果该方法存在，那么直接调用它并将传入的k/v参数做为元数据的key和value，并返回一个函数；若不存在，则__metadata方法就为一个空函数。

~~~ts
var __metadata =
  (this && this.__metadata) ||
  function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
      return Reflect.metadata(k, v);
  };
~~~

最后返回`Reflect.metadata`内部实现：

~~~js
function Reflect.metadata(key: any, value: any) {
  return function (target: any, propertyKey: string) {
    Reflect.defineMetadata(key, value, target, propertyKey);
  }
}
~~~

##### `__decorate`

+ 判断this中有没有`__decorate`是否被定义，被定义直接使用；未定义，则定义一个能接收4个参数的函数，分别是`decorators`函数数组、`target`所装饰类的构造函数或类的原型对象、`key`所装饰类成员的名字、`desc`所装饰类成员的描述符；

+ 定义一个变量`c`存储运行时实际传入`__decorate`函数的参数个数；

+ 定义一个变量`r`，`r`中存储的内容根据实际传入`__decorate`函数的参数个数不同而不同：

  a. 传入2个时，`r`为类的构造函数或类的原型对象；

  b. 传入4个时，`r`根据`desc`是否为`null`，是则存储类成员的描述符（**访问器装饰器**、**方法装饰器**），否则为`undefined`（**属性装饰器** ）；
+ 定义一个未初始化变量`d`；
+ 判断是否存在`Reflect.decorate`，若存在，则直接调用该方法。否则执行下面的else
+ **这一步是该函数的核心**。从后向前遍历`decorators`装饰器函数数组，并在每次遍历中将遍历到的函数赋值给变量`d`。若d不为空，则根据运行时实际传入`__decorate`函数的参数个数进入不同的分支：

  a. **传入2个时（<3， 类装饰器）**，将`r`中存储的类的构造函数或类的原型对象做为唯一参数传入`d`中并调用。

  b. **传入4个时（>3，属性装饰器、访问器装饰器、方法装饰器 ）**，将`target`类的构造函数或类的原型对象、`key`装饰的类成员的名字以及 `r`类成员的描述符或`undefined`传入`d`中并调用。

  c. 传入3个时（目前并不存在这种情况，可能是属性装饰器的兼容实现），将`target`类的构造函数或类的原型对象、`key`装饰的类成员的名字传入`d`中并调用。

  最后，重新赋值`r`为函数`d`运行后的返回值（若有）或者`r`本身（`d`无返回值）；
+ 若实际传入`__decorate`函数的参数为4个且`r`存在，那我们将装饰器所装饰目标的值替换为`r`。
+ 最后返回r
~~~ts
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
    else
      // 从后向前遍历，属性装饰器会执行d(target, key, r)
      for (var i = decorators.length - 1; i >= 0; i--)
        if ((d = decorators[i]))
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  };
~~~

注：

1. `decorators`装饰器函数数组是倒序遍历并调用，因此装饰器的执行顺序是从靠近被装饰者的装饰器开始依次向上执行；
2. 装饰器函数执行后中若存在返回值，则返回值会通过`Object.defineProperty(target, key, r)`替代被装饰者的值；
3. **装饰器会紧跟在类声明后执行，并非实例化后执行；**
4. 不同类型的装饰器执行顺序依次是——属性装饰器、访问器装饰器、参数装饰器、方法装饰器、类装饰器。

### TS泛型

**泛型是指在定义函数、接口或类的时候，不预先指定具体的类型，使用时再去指定类型的一种特性。**有关联的类型可以用`<T>`表示

在使用泛型的时候可以有两种方式指定类型。

- 使用的时候再指定类型
- TS 类型推断，自动推导出类型

~~~ts
// 有关联的地方都改成 <T>
function createArray<T>(length: number, value: T): Array<T> {
    let result: T[] = [];
    for (let i = 0; i < length; i++) {
        result[i] = value;
    }
    return result;
}

// 使用的时候再指定类型
let result = createArray<string>(3, 'x');

// 也可以不指定类型，TS 会自动类型推导
let result2 = createArray(3, 'x');
console.log(result);
~~~

## 源码调试：new Model()后会发生什么

再理解上述概念后，即可开始源码调试，理解ModelBase的具体实现过程：

~~~ts
export class Consumer extends ModelBase {
  @Column()
  public id?: number

  @Column({ trim: true })
  public userName?: string
  
  @Column({ model: ConsumerItem, autowired: true })
  public consumerList!: ConsumerItem[]
}

const p1: Consumer = ref(null)
p1.value = new Consumer({userName: 'admin'})
// p1: Consumer {id: undefined, userName: 'admin', consumerList: Array(0)}
const p1_ = p1.getCleanSerializableObject()
// p1_: {userName: 'admin'}
~~~

### 属性装饰器工厂函数`Column`的实现

当我们声明Consumer类时，装饰器函数紧接着执行。根据上文属性装饰器源码分析，我们知道执行顺序为：

1. `Reflect.defineMetadata("design:type", String, Consumer.prototype, "被装饰属性")`给被装饰属性添加类型元数据，并放到类的原型上（因为这不是静态属性）
2. `Column(Consumer.prototype，key)`

那我们第一个问题先来看，定义模型的时候，`@Column`这个属性装饰器函数具体干了些什么：

~~~ts
// IColumn定义了所有元数据的类型，返回一个属性装饰器函数，类型PropertyDecorator是TS默认的属性装饰器类型
export function Column(col?: IColumn): PropertyDecorator {
  // params为定义的元数据对象，@Column()内的参数
  let params = col as IColumnInner
  // 属性装饰器的两个参数：target=Consumer.prototype，被装饰属性property
  return (target: any, property: string | symbol) => {
    let columns = Reflect.getOwnMetadata(
      LOCA_COLUMN_KEY,
      target,
    )
    // 初始化
    columns = columns || {}
    // 如果没有写元数据，需要有这几个默认的，前端处理默认是驼峰规范
    if (!params) {
      params = { camelCaseName: property, column: undefined, type: undefined }
    }
    // 兼容childType，新的名字为model，如果
    params.childType = params.childType || params.model
    if (params && !params.hasOwnProperty('name')) {
      if (typeof property === 'symbol') { // symbol是可以作为属性key的
        property = property.toString()
      }
      // 转化为下划线，遍历+正则转化，这是后端规范
      params.name = genUnderlinePropName(property)
      // 如果 property 自己定义的名字不符合驼峰规范则不做强制改变。
      params.camelCaseName = property
    }
    // 拿到当前被装饰数据的类型，在前面有说明这个属性是怎么来的
    const type = Reflect.getMetadata('design:type', target, property)
    // @ts-ignore
    const File = File || Object // 小程序不支持 File对象，按照Object去处理
    let childType
    switch (type) {
      // 如果是数组类型，要判断子元素
      case Array:
        if (params.childType) {
          childType = params.childType
        }
        break
      case Object:
      case Number:
      case String:
      case Boolean:
      case Map:
      case WeakMap:
      case Set:
      case WeakSet:
      case Symbol:
      case Function:
      case File:
        break
      default:
        // 除了基本类型之外，其他的复杂类型（class等）都是设置为 type
        childType = type
    }
    let g: any
    // 处理元数据group
    if (Array.isArray(params.group)) {
      g = params.group
    } else if (typeof params.group === 'string') {
      g = [params.group]
    } else {
      g = undefined
    }
    // column是个键值对象，存储了所有属性的元数据。
    // key为属性，value是元数据对象
    columns[property] = {
      column: params.name,
      camelCaseName: params.camelCaseName,
      aliasName: params.aliasName,
      type,
      group: g,
      formatter: params.formatter,
      trim: params.trim,
      primary: params.primary,
      foreign: params.foreign,
      default: params.default,
      autowired: params.autowired,
      unformatter: params.unformatter,
      childType,
    }
    // 整个Column定义在当前类的元数据上，key为LOCA_COLUMN_KEY这个Symbol对象。
    Reflect.defineMetadata(
      LOCA_COLUMN_KEY,
      columns,
      target,
    )
  }
}
~~~

最终就是给当前类的**实例对象**添加了一个元数据，key为一个Symbol值：LOCA_COLUMN_KEY，value为一个对象，对象的key为对应属性的名称，对象的value为这些属性对应的元数据对象（根据@Column()内传递的参数确定，如果什么都不传，也会有一些默认的元数据，比如：下划线形式的name，驼峰类型的name，属性类型等）。

### class X extends P {}的原理

我们创建的Consumer类实际上是继承自父类ModelBase，再研究ModelBase源码前，先来看看extends关键字做了什么。

`class X extends P{}`也是ES6新增的语法，用于在js这门脚本语言中，实现继承的特性（面相对象编程语言的特性），当然本质也是通过原型实现的。

下面是使用extends后经过Babel编译转化为ES5的源码实现，因为代码很长，分布讲解：

#### 主流程

~~~js
var X = function(P1) {
    "use strict";
    _inherits(X, P1);
    var _super = _createSuper(X);
    function X() {
        _classCallCheck(this, X);
        return _super.apply(this, arguments);
    }
    return X;
}(P);
~~~

#### 通过`_inherits`实现继承

编译器封装的继承方法，第一个参数是子类，第二个参数是继承的父类。

+ 先进行父类类型的检验，必须是function或者null
+ 两条继承路线，分别实现子类和子类实例的继承
  + 设置子类的隐式原型 => Object.create创建的一个新对象，这个新对象的原型指向父类（如果父类原型为空，再指向父类的原型），第二个参数用于定义新对象的constructor属性和属性描述符
  + 设置子类的显示原型（ `__proto__` ) 为父类，通过`Object.setPrototypeOf`，这样子类也可以直接调用父类原型的属性或方法：`subClass.父类的方法/属性`

`subClass.prototype = Object.create(superClass)`相当于

~~~js
function F() {}
F.prototype = superClass
subClass.prototype = new F()

// subClass.prototype.__proto__ => F.prototype => superClass
~~~

~~~js
function _inherits(subClass, superClass) {
    // 父类检验
    if (typeof superClass !== "function" && superClass !== null) {
        throw new TypeError("Super expression must either be null or a function");
    }
  	// 添加prototype，X.prototype = P && P.prototype
    subClass.prototype = Object.create(superClass && superClass.prototype, {
        constructor: {
            value: subClass,
            writable: true,
            configurable: true
        }
    });
  	// 添加 __proto__，X.__proto__ = P
    if (superClass) _setPrototypeOf(subClass, superClass);
}

function _setPrototypeOf(o, p) {
    _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
        o.__proto__ = p;
        return o;
    };
    return _setPrototypeOf(o, p);
}
~~~

#### 调用父类构造函数（子类没有constructor时）

+ 核心代码中，`var _super = _createSuper(X);`，调用`_createSuper(X)` 会返回一个包装函数，函数会在子类 `X` 实例化时执行；
+ 当子类没有写constructor时候，`new X()` 时，执行包装函数 `_super`，包装函数的内部逻辑是**查找并调用**当前子类的父类构造函数（`P`），然后返回执行结果

##### `Reflect.construct()`

+ 用于创建构造函数，但是支持传参（父类构造函数，参数，子类构造函数），更灵活。
+ 如果就传递了父类构造函数，Reflect.construct()会使用它来创建一个新的对象实例。
+ 如果还传了子类的constructor，会将父类构造函数作为子类构造函数的原型，并将子类构造函数作为新对象的构造函数。

~~~js
/**
 * _createSuper函数是用来创建一个子类的构造函数。
 * @param {Function} Derived 子类
 * @returns {Function} 返回一个包装函数 _createSuperInternal
 */
function _createSuper(Derived) {
    // 判断当前环境是否支持原生的 Reflect.construct 方法
    var hasNativeReflectConstruct = _isNativeReflectConstruct();
    return function _createSuperInternal() {
        // 获取子类的原型对象
        var Super = _getPrototypeOf(Derived);
        if (hasNativeReflectConstruct) {
            // 如果支持 Reflect.construct 方法，则通过 Reflect.construct 方法创建一个新的实例
            // Reflect.construct 方法的第一个参数为父类构造函数，第二个参数为子类实例的构造函数参数，第三个参数为子类的构造函数
            var NewTarget = _getPrototypeOf(this).constructor;
            result = Reflect.construct(Super, arguments, NewTarget);
        } else {
            // 如果不支持 Reflect.construct 方法，则通过 Super.apply 方法调用父类的构造函数
            result = Super.apply(this, arguments);
        }
        // 返回值 || 子类的实例
        return _possibleConstructorReturn(this, result);
    };
}

/**
 * _possibleConstructorReturn 函数是用来判断是否有返回值
 * @param {Object} self 子类的实例
 * @param {Function} call 调用结果
 * @returns {Object} 返回子类的实例或调用结果
 */
function _possibleConstructorReturn(self, call) {
    if (call && (_typeof(call) === "object" || typeof call === "function")) {
        return call;
    }
    // 如果没有返回值，则返回子类的实例
    return _assertThisInitialized(self);
}
~~~

+ 当子类有写constructor逻辑

  + 会先执行父类构造函数（`_this = _super.call(this, a)`），通过Reflect.constructor将父类构造函数放到子类构造函数的原型上，所以这里可以调用它
  + 再在返回的对象基础上执行子类构造函数里的逻辑（`_this.b = "b"`）
  + 返回最终的（`_this`）

  ~~~js
  class X extends P {
      constructor(a) {
          super(a);
          this.b = 'b';
      }
  }
  
  // 编译ES5
  var X = function(P1) {
      "use strict";
      _inherits(X, P1);
      var _super = _createSuper(X);
      function X(a) {
          _classCallCheck(this, X);
          var _this;
          // 关键代码
          _this = _super.call(this, a);
          _this.b = "b";
          return _this;
      }
      return X;
  }(P);
  ~~~

  

**总结：class Consumer extends ModelBase {}**

1. 将`Consumer.prototype`指向`Object.create`创建的一个新对象，新对象的原型 =>`ModelBase` ，因此 Consumer的实例对象能访问到Modelbase里的原型方法
2. 将`Consumer.__proto__`设置为`ModelBase`
3. 重新设置构造函数
4. 当创建实例时，`Consumer`没有写constructor，执行`ModelBase`的构造函数

### ModelBase的构造函数

new Consumer后，因为Consumer继承了ModelBase，所以会先执行父类的构造函数。

1. 获取到响应式对象或者代理对象的原始值

2. 给实例对象定义一个key为`LOCA_COLUMN_KEY`的元数据，值初始为空对象

3. `columns_`初始化通过原型方法`getColumns`拿到元数据
4. 设置WeakMap对象，key为当前实例的构造函数`Consumer`，值为元数据对象`columns_`
5. 最后通过`createModelByDTO`根据传过来的数据设置模型数据和元数据，内部还会通过`ModelBase.saveChangedData`来保存初始化的数据

~~~js
// 用WeakMap的原因，是因为有很多动态模型创建好后会被释放掉。而普通的map对象会让 modelColumnsMap 越来越大。
export const modelColumnsMap = new WeakMap()
const LOCA_DATA_MODEL_KEY = Symbol('locaDataModelKey')
export class ModelBase {
  constructor(dto?: any, options?: IModelOptions) {
    const t_ = toRaw(this)
    if (!Reflect.getOwnMetadata(
      LOCA_COLUMN_KEY,
      t_,
    )) {
      Reflect.defineMetadata(
        LOCA_COLUMN_KEY,
        {},
        t_,
      )
    }
    let columns_ = modelColumnsMap.get(t_.constructor)
    if (!columns_) {
      columns_ = (t_ as any).getColumns({ dto })
      modelColumnsMap.set(t_.constructor, columns_)
    }
    createModelByDTO(t_, columns_, dto, options)
  }
}
~~~

#### `toRaw`

在Vue3中响应式采用代理对象的形式实现，如果使用new创建新对象，this将指向当前新创建的对象，如果新对象是响应式的，this将指向这个响应式对象的代理对象，而不是他本身。

~~~js
export class Consumer extends ModelBase {
  @Column()
  public id?: number

  @Column({ trim: true })
  public userName?: string
  
  @Column({ model: ConsumerItem, autowired: true })
  public consumerList!: ConsumerItem[]
}

const p1: Consumer = ref(null)
p1.value = new Consumer({userName: 'admin'})
~~~

**为什么this不能使用代理对象？**

因为装饰器工厂函数`@Column`将元数据都定义在Consumer类的实例对象上，this如果指向代理对象，无法访问到原型对象上的属性和方法。

~~~ts
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as any).__v_raw
  return raw ? toRaw(raw) : (observed as any)?.__target__ ? (observed as any).__target__ : (observed as any)
}
~~~

+ 判断`observed.__v_raw`是否存在，如果存在，说明 `observed` 是一个响应式对象，需要继续调用 `toRaw` 函数，将 `raw` 作为参数传入，以获取其原始值。
+ 如果 `__v_raw` 不存在，继续判断 `observed.__target__` 是否存在。如果存在，说明 `observed` 是一个**代理对象**，直接返回 `observed` 的 `__target__` 属性，否则直接返回`observed`

#### `getColumns`

这一步很关键，从`modelColumnsMap`这个`Weakmap`中去拿到元数据对象，大大节省了性能，因为每次new一个新对象时候如果都调用`getColumns`拿取保存在类原型中的元数据，造成了性能上的浪费。

~~~ts
let columns_ = modelColumnsMap.get(t_.constructor)
if (!columns_) {
  columns_ = (t_ as any).getColumns({ dto })
  modelColumnsMap.set(t_.constructor, columns_)
}
~~~

第一次new的时候，我们会从原型中取出Columns并处理好，放到这个WeakMap对象中，之后直接从WeakMap中取元数据。

**这是因为，我们的Model可能存在多继承的情况，这个时候会执行merge合并所有继承父类的元数据对象，如果每次都进行合并会造成性能的浪费，因此只需要在第一次new的时候将合并好的元数据对象存到WeakMap中。**

~~~ts
  public getColumns(data?: { dto?: any }) {
    // 拿到原始数据
    const t_ = toRaw(this)
    let columns_ = {} as { [key: string]: IColumnInner }
    // m初始化时未定义
    const m = Reflect.getOwnMetadata(
      LOCA_DATA_MODEL_KEY,
      t_.constructor,
    )
    
    let columns = {} as { [key: string]: IColumnInner }
    columns = merge(columns_, getColumnsUtil(columns, Object.getPrototypeOf(t_)) || {}, {
      clone: true,
    })
    return columns
  }
~~~

#### `createModelByDTO`

根据元数据对象，和传入的dto设置，当前实例对象的属性。

~~~ts
export function createModelByDTO(model: ModelBase, props: any, dto: any, options?: IModelOptions) {
  // 初始化的时候可以是空
  const modelDTO: { [index: string]: any } = dto || {}
  setModelByDTO('create', model, props, modelDTO, options)
  model.saveChangedData({ group: options?.group, enableDataState: options?.current?.enableDataState })
}
~~~

##### `setModelByDTO`

遍历元数据对象，调用`initField`初始化所有字段。

~~~ts
function setModelByDTO(flag: string, model: ModelBase, props: any, modelDTO: any, options?: IModelOptions) {
  for (const key in props) {
    if (props.hasOwnProperty(key)) {
      initField(flag, key, model, props, modelDTO, options)
    }
  }
}
~~~

###### `initField`

+ field是当前遍历的元数据对象的key，一般我们声明时都是驼峰形式，符合前端规范
+ `getColumnDto`根据传入的dto数据，拿到field字段对应的真实数据，还会有些特殊处理
  + 因为后端规范采取下划线形式的命名风格，每个字段的元数据对象包含两种规范的命名形式。默认配置了`dtoNamingMethod === 'mix'`，所以无论是下划线风格还是驼峰风格，都能识别出来。
    + 先检查dto是否匹配元数据对象中的`column`(下划线风格)
    + 如果undefined，再检查是否匹配元数据对象中的`camelCaseName`（驼峰格式）
  + 如果还是识别不出来，会检查元数据对象是否包含别名，即元数据带有`aliseName`字段
  + 如果都没找到，说明传入的dto没有该属性，返回undefined
+ 当前字段的元数据包含`childType`，调用`createChildField`，深度处理，该对象的原型对象为另外一个model
+ 如果当前字段的`type = Array`（type元数据是设置属性装饰器所添加的），并且包含`childType`，要调用`getFormatterValue(model, field, deepCopy(data))`，说明数组中的每个数据都是要继承自这个childType的
+ 如果是基础类型数据，会调用`setDefault`给当前实例对象设置好属性，key为field的字段，value为传入的数据（不传的话是undefined）

~~~ts
function initField(flag: string, columnName: string, model: ModelBase, columns: any, data: any, options?: IModelOptions) {
  const field = columns[columnName]
  const columnDto = getColumnDto(model, data, field)
  if (flag === 'create') {
    if (typeof columnDto !== 'undefined') {
      if (field.childType) {
        (model as any)[columnName] = createChildField(model, field, columnName, data, options)
      } else {
        if (field.type === Array) {
          (model as any)[columnName] = getFormatterValue(model, field, deepCopy(data))
        } else {
          (model as any)[columnName] = getFormatterValue(model, field, data)
        }
      }
    } else {
      let noDefault = false
      if (options && typeof options.noDefault !== 'undefined') {
        noDefault = options.noDefault
      }
      if (!noDefault) {
        setDefault(model, field, columnName, data, options)
      }
    }
  }
~~~

##### `saveChangeData`

`saveChangeData`是`ModelBase`的类方法，核心逻辑是深拷贝处理好的dto。将拷贝好的数据当做元数据，存储到当前实例对象上。

~~~js
public saveChangedData(param) {
    const t_ = toRaw(this)
    let dto_ = {}
    const m = Reflect.getOwnMetadata(
      LOCA_DATA_MODEL_KEY,
      t_.constructor,
    ) || {}
    Reflect.defineMetadata(
      CLONE_KEY,
      deepCopy(dto_),
      t_,
     )
    }
    return this
  }
~~~

深拷贝代码代码如下：

```ts
export function deepCopy(aObject: any) {
  // 如果传入对象为空或不存在，则直接返回
  if (!aObject) {
    return aObject
  }

  let v
   // 初始化一个新的对象bObject，如果aObject是数组则初始化为一个空数组，否则初始化为一个空对象
  const bObject = Array.isArray(aObject) ? [] : {} as any
  for (const k in aObject) {
    v = aObject[k]
    bObject[k] = (Object.prototype.toString.call(v) === '[object Object]') ? deepCopy(v) : v
  }

  return bObject
}
```

是否存在优化方向？

1. `for...in`遍历会遍历到原型链上的属性，我们是否需要。如果不需要应该使用`forEach`，对象的话要先使用`Object.keys（）`再遍历。这样性能更好。

### 收发请求时如何结合ModelBase的？

我们在定义请求函数时，传入的第一个参数是url，第二个参数是一个配置对象，对象中各个参数的含义：

+ params：请求body
+ wrapper
+ beforeParse：拿到响应前的一些处理，常用于mock数据
+ afterParse：拿到响应后的一些处理

```ts
function testApi(id: string, dto: TestFilterModel) {
  const url = `xxx/${id}`
  return fetchBackend.get(url, {
    params: dto,
    wrapper: TestListModel, // 按wrapper类型转化params
    // beforeParse: (res) => {
    //  // 拿到响应数据前的一些操作
    //  // 一般在接口没完成时，前端mock数据用
    //  return res
    // },
    afterParse: (res) => {
      // 拿到响应数据后的一些操作
      return res
    },
  })
}
```

发送请求时调用了`fetchBackend`的`post`或者`get`方法。实际上`fetchBackend`调用了`Fetch`对象的`genFetch`方法。

~~~ts
export const fetchBackend = Fetch.genFetch(BASE_API, {
  needAuth: true,
  commonParams: {
    appId: APP_ID,
    appVer: version,
  },
})
~~~

`genFetch`内部调用了`genDriier`方法，内部用`new AxiosDriver`生成了一个二次封装过`Axios`的类，实际上调用的都是`Axios`的请求方法。

~~~ts
export function genDriiver(baseUrl: string, options: Options) {
  const { needAuth, commonParams, withTimestamp,  ...rest } = options
  const baseURL = getAbsoluteURL(baseUrl)
  return new Driver({
    api: new AxiosDriver({
      baseURL,
      // 请求公共参数
      commonParams: genCommonParams(commonParams),
      // 鉴权参数
      authorization: needAuth ? Auth.getAccessToken : undefined,
      // 请求返回且 http code 为 200 时的拦截器处理
      interceptors,
      // 为true的时候请求参数不会带timestamp
      withTimestamp: withTimestamp === false ? undefined : Date.now(),
      ...rest
    }),
    url: baseURL
  })
}
~~~

外面再用`CoreService`类封装。

~~~ts
export function genFetch(baseUrl: string, options: Options) {
  return new CoreService(genDriiver(baseUrl, options))
}
~~~

#### CoreService

~~~ts
export class CoreService {
  private driver!: Driver

  constructor(adapter: Driver) {
    this.driver = adapter
  }
	
  // 以get方法为例，后面省略了其他种类方法
  public get<T>(url: string, data?: IServiceParam<T>) {
    data = data || {}
    return this.request<T>(url, { ...data, type: 'get' })
  }
~~~

`get`方法接受两个参数，字符串类型url 和 data参数。利用**泛型**能支持多种类型数据的传参。data的类型定义如下：

+ 可以看到`afterParse`的类型是一个函数，传参和返回值都是带有泛型类型的`ServiceResponse`类，这个类我们后面再来说，他表示是后端的响应数据。
+ wrapper一般都是用我们定义的model，通过传入的model，确定了泛型参数T

~~~ts
export interface IServiceParam<T> {
  params?: ModelBase | any
  options?: any
  beforeParse?: (dto: any) => any
  afterParse?: (serviceResponse: ServiceResponse<T>) => ServiceResponse<T>
  wrapper?: DataWrapper |
    (new(dto: any) => T) |
    T[]
}
~~~

#### req请求函数

对请求体数据做一层处理，如果没有传入配置参数`allowEmptyData`允许空数据。就会调用`getCleanSerializableObject()`获得可被序列化的 object 对象，去除了 空字符 空对象 空数组。

~~~ts
export class CoreService {
  private req(url: string, data: {
    type: 'get' | 'post' | 'del' | 'put' | 'patch',
    params?: ModelBase | any,
    options?: any,
  }) {
    let params = data.params
    if (params instanceof ModelBase) {
      if (data.options && data.options.allowEmptyData) {
        params = data.params?.getSerializableObject()
      } else {
        params = data.params?.getCleanSerializableObject()
      }
    }
    return this.driver.getApi()[data.type](url, params, data.options)
  }
}
~~~

#### request响应函数

+ apiData存取后端的响应数据。如果配置了`beforeParse`，会调用该函数对原始的响应数据出炉。
+ beforeParse后，通过new ServiceResponse让后端返回的数据按照定义好的model返回。
+ 按照wrapper初始化data后，执行afterparse的逻辑，此时后端数据中的下划线风格命名已经被转化为前端规范下的驼峰格式，并按照定义的元数据初始化。


~~~ts
public async request<T extends any>(url: string, param?: IServiceParamRequest<T>) {
    let apiData
    try {
      apiData = await this.req(url, {
        type: param?.type || 'get',
        params: param?.params,
        options: param?.options
      })
      if (param?.beforeParse) {
        apiData = param.beforeParse(apiData)
      }
      let serviceResponse = new ServiceResponse<T>(apiData, param?.wrapper)
      if (param?.afterParse) {
        serviceResponse = param.afterParse.call(null, serviceResponse)
      }
      return serviceResponse
    } catch (e: any) {
      if (e.result_code) {
        throw new ServiceResponse<T>(e)
      } else {
        const serviceResponse = new ServiceResponse<T>({
          result_code: 'service_error'
        })
        serviceResponse.serviceError = e
        throw serviceResponse
      }
    }
  }
~~~

#### ServiceResponse

~~~ts
export class ServiceResponse<T = any> extends ModelBase {
  @Column()
  public requestId!: string

  @Column()
  public resultCode!: string

  @Column()
  public message!: string

  @Column({ name: 'data', aliasName: 'resultData' })
  public data!: T

  constructor(
    dto?: any,
    wrapper?:
      DataWrapper |
      (new(dto: any) => T) |
      T[],
  ) {
    super(dto)

    if (wrapper) {
      // 对各种类型的wrapper处理
      // ...省略
      // 对于流数据特殊处理
      } else if ((wrapper as any).getClassName && (wrapper as any).getClassName() === DataStreamWrapper.className) {
        // content-type 不存在或者 不包含 application/json，则按照 blob的处理方式处理。
        if (!dto?.headers?.['content-type'] || dto?.headers?.['content-type']?.indexOf('application/json') === -1) {
          // stream默认是没有data属性，dto需要设置到data上
          this.data = dto
          if (this.data) {
            this.data = (wrapper as DataWrapper).getData(this.data) as any
            this.resultCode = this.resultCode || 'success'
          } else {
            this.resultCode = 'stream_is_empty'
          }
        }
      } else {
        const classType = wrapper as any
        if (classType) {
          this.data = new classType(dto && dto.data)
        }
        // }
      }
    }
  }

  public isValid(){
    return this.resultCode === 'success'
  }
}

~~~

---

### 判断传入的dto是否属于元数据中定义的key

ToDo：写一个实例方法，传入dto数据判断dto对象的键名是否extends，columnData的key

~~~ts
class ModelBase {
  public checkDtoKeys(dto: Record<string, any>): boolean {
    const t_ = toRaw(this)
    const keys = Object.keys(dto)
    for (const key of keys) {
      const columnData: Record<string, any> = Reflect.getOwnMetadata(LOCA_COLUMN_KEY, t_.constructor.prototype)
      if (!(key in columnData)) {
        console.log(`${key} extends columnData's key`)
        return false
      }
    }
    console.log('all keys extends columnData\'s key')
    return true
  }
}
~~~



