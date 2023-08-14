### Column装饰器的参数 
#### type 
对象属性字段的类型，声明类型是为了静态代码检查。 
举例，常用的几个类型如下，我们只需要重点学习嵌套类型的class： 

```
class DataItem extends ModelBase {

  @Column() 

  public id!: string // String

}

class DataObj extends ModelBase {

  @Column() 

  public id!: string // String

  @Column()

  public bool!: boolean // Boolean

  @Column()

  public count!: number // Number

  @Column()

  public num!: string[] // Array

  @Column({ model: DataItem }) // 传入model的值为DataItem，方便递归创建实例对象。

  public item!: DataItem[] // Array

}
```

- 不需要传入，但是要正确的声明，通过Reflect.getMetadata('design:type', target, property)自动读取。
- 支持的数据类型_**Array、Object、Number、String、Boolean、Map、WeakMap、Set、WeakSet、Symbol、Function、File、Any**_
- _**Array、Object**的特殊用法详见：model_
#### model（原childType）?: any 
递归生成复杂对象的时候所需要，非必传，但是Array和Object需要传入model。 
对比下后端的showdoc可能更好理解！model就是connectInfo、alarmInfo、chargingConnextListItem等。 
![](https://cdn.nlark.com/yuque/0/2023/png/29807260/1691657422765-b44787fc-83d7-40f7-a2c9-06c565b8e920.png#averageHue=%23e9e8e8&clientId=u0352c5dc-9505-4&from=paste&id=ub3cb3f77&originHeight=1628&originWidth=826&originalType=url&ratio=1&rotation=0&showTitle=false&status=done&style=none&taskId=u77b9c0de-b160-42c0-8156-5bbd8b84cb5&title=)
使用model，我们需要了解两个概念（前端人员必读）： 

- item属性的类型DataItem[]
   - 它只是声明。
   - 类型概念是typescript提供的，在编译成js代码后是没有类型概念的，所以我们拿不到class对象DataItem。
- item对应的class对象DataItem
   - 它是用来干活的。
   - 通过装饰器@Column({ model: DataItem })实现。
   - 装饰器的原理其实就是调用了Column函数，并且传入参数{ model: DataItem }，最后通过[metadata（点击查看）](https://anuoua.github.io/2020/07/09/reflect-metadata原理/)存入内部，方便new DataObj()的时候在内部读取到。（有兴趣的也可以去了解链接中的inversifyjs，由于它加重了学习成本，所以放弃使用，但是设计思路还是值得学习）。

```
// 具体来看一下如下的例子

class DataItem extends ModelBase {

  @Column() 

  public id!: string // String

}

class DataObj extends ModelBase {

  @Column({ model: DataItem }) // item对应的class对象DataItem ，他是真实存在的。

  public item!: DataItem[] // item属性的类型DataItem[]，它是不真实的。

}



Reflect.getMetadata('design:type', target, 'item') // Array

// 这样我们在new DataObj()的时候，也会利用DataItem原型自动循环创建item属性。
```
注意：旧的写法childType，新的写法是model。
示例： 
定义模型 

```
export class ConsumerItem extends ModelBase {

  @Column()

  public id!: string



  @Column()

  public userName!: string

}



export class Consumer extends ModelBase {

  @Column({ model: ConsumerItem, autowired: true })

  public consumerList!: ConsumerItem[]



  @Column({ model: ConsumerItem })

  public consumerObject!: ConsumerItem

}
```
注意！这两个class不在同一个文件里面，需要用相对路径来引用，否则会有循环依赖的问题。
看一下输出结的区别来学习model。 

```
// 实例化

const consumer = new Consumer({

    consumer_list: [{

        id: 2,

        user_name: 'leijun.yang'

    }],

    consumer_object: {

        id: 1,

        user_name: 'shuai.meng'

    }

})

// 输出结果

console.log(consumer)

{

    consumerList: [{

        id: 2,

        userName: 'leijun.yang'

    }],

    consumerObject: {

        id: 1,

        userName: 'shuai.meng'

    }

}

// 区别在哪里？

// 下划线转驼峰了。

// 数组里面的对象也可以调用ModelBase原型的所有方法。

consumer.consumerList[0].name = 'xiaoheng.li'

consumer.consumerList[0].getChangeData()
```
注意：如果我们不声明model（childType）会发生什么？90%的新人会忽略的点。

```
// 如果没有传入model

console.log(consumer)

{

    consumerList: [{

        id: 2,

        user_name: 'leijun.yang'

    }],

    consumerObject: {

        id: 1,

        user_name: 'shuai.meng'

    }

}



consumer.consumerList[0].name = 'xiaoheng.li'

consumer.consumerList[0].getChangeData() // error 报错，没有getChangeData方法。
```
不传入model的区别： 

1. consumerList和consumerObject的key不受影响，但是实例化出来的值user_name已经不再是转驼峰风格了。
2. 不可以调用ModelBase原型的所有方法（如getChangeData）。

这下清晰了吧？一个是普通的Object，一个是继承了ModelBase的实例化对象。
#### default?: any 
创建对象时候属性的默认值，基本类型用default，复杂类型用autowired或者函数。 

- 引用对象必须通过函数来创建。
   - 详见autowired章节。
   - default等于true不再使用，语义上不好理解。

举例： 

```
export class ColumnCamelCase extends ModelBase {

  @Column({ model: Child, default: () => {return []} })

  public a!: Child[]

  

  @Column({ model: Child, default: true })

  public b!: Child[]

  

  @Column({ model: Child, autowired: true })

  public c!: Child

}
```
#### autowired: boolean 
默认值：false。 
是否自动注入初始化的值，适用于数组和对象，依赖model来进行自动初始化。 
以下前端开发人员必读！

- 对于Array类型或者使用了model（或childType），可以用autowired: true。

```
export class Child extends ModelBase {

  @Column()

  public message!: string;

}



export class Parent extends ModelBase {

  @Column({ model: Child, autowired: true })

  public b!: Child[]

    

  @Column({ model: Child, autowired: true })

  public c!: Child

}
```
我们来对比下效果 

```
const p = new Parent()

// 传入了autowired。

console.log(p)

{

    b: [],

    c: {

        message: undefined

    }

}

// 如果没有autowired或者autowired=false。

console.log(p)

{

    b: undefined,

    c: undefined

}
```
观察值：b=[]，c={ message: undefined }
注意：有一些提交数据的场景是不能用这个模型的，否则会把b=[]和c={ message: undefined }提交到后台。
解决办法有两个，如下： 

1. 我们额外创建一个新的模型如ParentUpdate，模型中不设置default或者autowired。
2. new Parent({noDefault: true})（不会初始化default）。

如果更新模型和展示模型差异大，推荐第一种，如果没什么差异推荐第二种。
#### name?: string 
想要更好的理解name，我们需要理解输入和输出数据流向的概念，（详见开头output流向数据）。 
一般来说输入和输出流向数据的key是一致的，name的默认值是Column所装饰属性的下划线命名方式。 
简单来说呢，后端给我的user_name，我给后端的也是user_name，友好相处，举例如下： 

```
export class Model extends ModelBase {

  @Column()

  public userName!: string

}

// name是user_name

const m = new Model({user_name: 'shuai.meng'})

console.log(m.getSerializableObject())

// output流向数据的key是下划线的user_name

{

    user_name: 'shuai.meng'

}
```
我们看到输入和输出的流向数据都是下划线命名，只是前端使用的时候是驼峰的。 
更复杂的模式，前端人员遇到困难的时候来往下看看吧！
**主动设置name**
会改变输入和输出流向数据的key，单向拓展输入流向数据的key可以参照aliasName。 
后面考虑让name识别user.title，简化模型的创建。 

```
export class Model extends ModelBase {

  @Column({ name: 'title' })

  public userName!: string

}

console.log(m.getSerializableObject())

// output流向数据的key是主动设置的'title'

{

    title: undefined

}
```
**全局设置name的命名方式（公司级别的风格设置）**
不是常用的使用方式，我们重点关注通过方法改变输出流向数据的命名方式。 
input流向数据的key命名。 

```
// 后端返回的数据的key可以是下划线或者驼峰的命名方式，都可以被正确的识别。

ModelBase.dtoNamingMethod = 'mix'
```
output流向数据的key命名。 
默认是''，代表的是下划线方式。可选值是'camelCase' 

```
// 可选值是camelCase或''。

ModelBase.columnNamingMethod = ''
```
默认行为（我们公司用这种风格） 
_dtoNamingMethod _= 'mix' 
_columnNamingMethod _= 'camelCase' 

```
ModelBase.dtoNamingMethod = 'mix'

ModelBase.columnNamingMethod = 'camelCase'



const c = new Consumer({ user_name: 'org', phoneNumber: '031-3939234' })

console.log(c.getCleanSerializableObject())



{ userName: 'org', phoneNumber: '031-3939234' }
```
_columnNamingMethod = 'camelCase'（output）_
_dtoNamingMethod _= 'camelCase'（_input_） 

```
ModelBase.dtoNamingMethod = 'camelCase'

ModelBase.columnNamingMethod = 'camelCase'



const c = new Consumer({ user_name: 'org', phoneNumber: '031-3939234' })

console.log(c.getCleanSerializableObject())

// output的数据都是驼峰模式，并且input的数据只能是驼峰。

// 如果是userName则会被解析，但是user_name不再被解析。

{ phoneNumber: '031-3939234' }
```
_columnNamingMethod _= 'camelCase'_（output）_

```
ModelBase.dtoNamingMethod = 'mix'

ModelBase.columnNamingMethod = 'camelCase'



const c = new Consumer({ user_name: 'org', phoneNumber: '031-3939234' })

console.log(c.getCleanSerializableObject())

// output的数据都是驼峰模式，并且input的数据可以是驼峰和下划线。

{ userName: 'org', phoneNumber: '031-3939234' }
```
**局部设置name的命名方式**
虽然有了公司级别的代码风格，但是总会有那么几个特例来吸引眼球，比如紫色的这一行字，以下代码前端人员看看就好了。
获取output流向数据的方法都可以通过{ camelCase: true }来改变output流向数据key的命名方式。 
常见场景：接收表单数据的后台接口需要驼峰命名的key。 
注意：因为我们默认是下划线的，所以{ camelCase: true }在某些项目中比较常用。

```
const c = new Consumer({ user_name: 'org' })

console.log(c.getSerializableObject({ camelCase: true }))

// 驼峰模式的。

{ userName: 'org' }
```
output流向数据都是下划线模式的（默认行为）。 

```
const c = new Consumer({ user_name: 'org' })

console.log(c.getSerializableObject({ camelCase: false }))

// 下划线模式的。

{ user_name: 'org' }
```
#### aliasName?: string | symbol 
input流向数据的key别名。 
前端开发遇到困难的时候可以来这里。
设置input流向数据的时候，默认会优先取name对应的值，如果不存在才会去取aliasName对应的值。 

```
export class AliseName extends ModelBase {

  @Column({ aliasName: 'user_uame1' })

  public uName1?: string // 默认的key分别是u_name1，别名key是user_uame1



  @Column({ aliasName: 'user_name2' })

  public uName2?: string // 默认的key分别是u_name2，别名key是user_name2

}
```
用别名初始化input流向数据，获取output流向数据。 
注意：aliasName只影响input流向数据，不影响output流向数据。

```
const c = new AliseName({

    user_uame1: 'shuai.meng1',

    user_name2: 'shuai.meng2'

}).getCleanSerializableObject()

console.log(c)

// 数据可以正确的被初始化

{

    u_name1: 'shuai.meng1',

    u_name2: 'shuai.meng2'

}
```
#### formatter?: any 
用input数据进行初始化的时候会自动调用formatter。详见开头：input流向数据。 
不建议所有的数据都通过formatter，尽量少用，模型复用的时候容易造成数据污染而不自知。

```
interface formatter {

    value: any // 当前值

    key: string // 当前key

    data: any // 所有数据

    columns: any[] // 所有的column的定义

}

// 将后端数字类型的value转换为精度是两位小数的字符串。

function formatterNumber2({ value, key, data, columns }: formatter) {

  return value?.toFixed(2).toString()

}



class EvBattery extends ModelBase {

  @Column({ default: '0.00', formatter: formatterNumber2 }) soc!: string

}

// 初始化input流向数据。

const c = new EvBattery({ soc: 90.124 })



console.log(c)

{

    soc: '90.12'

}
```
#### unformatter?: any 
获取output流向数据的时候会自动调用unformatter。详见开头：output流向数据。 
注意：和formatter的用法相反。

```
interface formatter {

    value: any

    key: string

    data:any

    columns: any[]

}



function unfNumber3({ value, key, data, columns }: formatter) {

  return value?.toFixed(3).toString()

}



class EvBattery extends ModelBase {

  @Column({ unformatter: unfNumber3 }) num!: number

}

const c = new EvBattery({ num: 90.1245 })

// 打印output流向数据。

console.log(c.getSerializableObject())

{

    num: '90.124'

}
```
#### primary?: boolean 
主键和外键极少使用，了解下就行了。 
调用getChangedDescriptor的时候才需要设置的属性。一般用于数组类型的字段上，用于两个对象的比较，根据主键来判断当前的数据状态是新增，修改还是删除。 
**实际运用的场景：**
对一个表单里面的数组进行新增、修改和删除。 
![](https://cdn.nlark.com/yuque/0/2023/png/29807260/1691657422788-75df199f-b4b6-4307-896d-5f13142ecbe6.png#averageHue=%23fefefd&clientId=u0352c5dc-9505-4&from=paste&id=u0d0d3a78&originHeight=638&originWidth=1022&originalType=url&ratio=1&rotation=0&showTitle=false&status=done&style=none&taskId=u45b8483e-3317-4420-a958-93aaaa649dc&title=)
我删除域名3，更新了域名1为1-1。 
![](https://cdn.nlark.com/yuque/0/2023/png/29807260/1691657422749-db46589b-6554-4c82-9ae3-8f2df01a3c8d.png#averageHue=%23fefefe&clientId=u0352c5dc-9505-4&from=paste&id=u878143e1&originHeight=508&originWidth=1076&originalType=url&ratio=1&rotation=0&showTitle=false&status=done&style=none&taskId=u30865837-b414-4d2e-bf31-1cbb38ce786&title=)
我只要设置好primay，我就可以很方便的知道谁是被新增、修改和删除的。 
**为啥会有这种场景？**
因为针对新增、修改和删除，我们需要自己前端识别出来告诉后端，方便后端不用写这个逻辑了。后端不写前端写，所以我们通过一行代码来搞定getChangedDescriptor()。
**输出格式**

- key（实例化属性的key）
   - primaryChangeDescriptor
      - 数组子对象变化的数据的描述，包括create、update、delete、noChange。
   - dataKey
      - 变化属性的output流向数据的key。
   - currentValue
      - 最新值。
   - oldValue
      - 旧值。
   - changeDescriptor
      - 变化的数据的描述，包括create、update、delete。
   - action
      - UPDATE、CREATE、DELETE。

**case示例：**
我们做了一系列的操作 

```
// init data

const c = new Consumer({

consumerList: [{

  id: '1'

}, {

  id: '2',

  message: 'message2'

}, {

  id: '4',

  message: 'message4'

}]

})

c.saveChangedData()



// update id 2

c.consumerList[1].setColumnData('message', undefined)

c.consumerList[1].name = 'newName'



// add id 3

const cItem = new ConsumerItem({ id: '3' })

cItem.message = 'message3'

c.consumerList.push(cItem)



// remove id 4

c.consumerList = c.consumerList.filter((item) => {

if (item.id !== '4') {

  return true

}

})
```
**我们期待的结果**

```
const expectData = {

    consumerList: {

      primaryChangeDescriptor: {

        create: [{

          id: '3',

          message: 'message3'

        }],

        delete: [{

          id: '4',

          message: 'message4'

        }],

        update: [{

          id: '2',

          name: 'newName'

        }],

        noChange: [{

          id: '1'

        }]

      },

      dataKey: 'consumer_list',

      currentValue: [

        {

          id: '1'

        }, {

          id: '2',

          name: 'newName'

        }, {

          id: '3',

          message: 'message3'

        }],

      oldValue: [

        {

          id: '1'

        }, {

          id: '2',

          message: 'message2'

        }, {

          id: '4',

          message: 'message4'

        }],

      changeDescriptor: {

        update: [{

          id: '1'

        }, {

          id: '2',

          name: 'newName'

        }, {

          id: '3',

          message: 'message3'

        }]

      },

      action: 'UPDATE'

    }

}
```
#### foreign?: boolean 
很久之前的一个特性，考虑的场景并不完善，暂不开放。一般用于socket通信获取到数据后和主键的值进行比较来进行更新行为：对当前数据的操作可能是update或者create。 

```
export class Battery extends ModelBase {

  @Column({ primary: true })

  public id!: string



  @Column()

  public soc!: number

}



export class Service extends ModelBase {

  @Column({ primary: true })

  public serviceId!: string



  @Column({ model: Battery, foreign: true })

  public evBattery!: Battery

}
```
#### trim?: boolean 
version: 1.4.10以上
设置当前属性在序列化的时候是否可以去除两端空格。 
示例请参照具体的序列化方法。[ModelBase Method Api](https://nio.feishu.cn/docs/doccnoGLiyswYfWqXMRUaCgv8Of#8ufhUm)

```
export class Consumer extends ModelBase {

  @Column({ trim: true })

  public userName?: string

}
```
#### group?: string 
version: 1.7.4以上
声明当前的column属于哪个组。最后通过getSerializableObject、getChangedData方法来获取对应分组的内容。 

```
import { Column, ModelBase } from 'loca-boot-core'



export class GroupData extends ModelBase {

  @Column()

  public emptyGroup?: string



  @Column({ group: 'group1' })

  public data1?: string



  @Column({ group: ['group1'] })

  public data2?: string



  @Column({ group: ['group1', 'group2', 'group3'] })

  public data3?: string



  @Column({ group: 'group2' })

  public data4?: string



  @Column()

  public data5?: string



  @Column()

  public data6?: string

}
```
**getSerializableObject({ group: 'group1' })**
获得column中被标记为“group1”的属性与没有做任何group标记的属性的并集。 

```
it('group1 getSerializableObject', () => {

  const c = new GroupData({ data1: 'data1', data2: 'data2', data3: 'data3' })

  c.data1 = '1'

  c.data2 = '1'

  c.data3 = '1'

  c.emptyGroup = '1'

  expect(c.getSerializableObject({ group: 'group1' })).toEqual(

    { data1: '1', data2: '1', data3: '1', empty_group: '1' },

  )

})

it('group2 getSerializableObject', () => {

  const c = new GroupData({ data1: 'data1', data2: 'data2', data3: 'data3' })

  c.data1 = '1'

  c.data2 = '1'

  c.data3 = '1'

  c.emptyGroup = '1'

  expect(c.getSerializableObject({ group: 'group2' })).toEqual(

    { data3: '1', empty_group: '1' },

  )

})

it('no group getSerializableObject', () => {

  const c = new GroupData({ data1: 'data1', data2: 'data2', data3: 'data3' })

  c.data1 = '1'

  c.data2 = '1'

  c.data3 = '1'

  c.emptyGroup = '1'

  expect(c.getSerializableObject()).toEqual(

    { data1: '1', data2: '1', data3: '1', empty_group: '1' },

  )

})
```
**getSerializableObject({ excludeGroup: 'group1' })**
获得column中没有被标记为“group1”的所有属性。 

```
it('group1 excludeGroup getSerializableObject', () => {

  const c = new GroupData({ data1: 'data1', data2: 'data2', data3: 'data3' })

  c.data1 = '1'

  c.data2 = '1'

  c.data3 = '1'

  c.emptyGroup = '1'

  expect(c.getSerializableObject({ excludeGroup: 'group1' })).toEqual(

    { empty_group: '1' },

  )

})

it('group2 excludeGroup getSerializableObject', () => {

  const c = new GroupData({ data1: 'data1', data2: 'data2', data3: 'data3' })

  c.data1 = '1'

  c.data2 = '1'

  c.data3 = '1'

  c.emptyGroup = '1'

  expect(c.getSerializableObject({ excludeGroup: 'group2' })).toEqual(

    { data1: '1', data2: '1', empty_group: '1' },

  )

})

it('group3 excludeGroup getSerializableObject', () => {

  const c = new GroupData({ data1: 'data1', data2: 'data2', data3: 'data3' })

  c.data1 = '1'

  c.data2 = '1'

  c.data3 = '1'

  c.emptyGroup = '1'

  expect(c.getSerializableObject({ excludeGroup: 'group3' })).toEqual(

    { data1: '1', data2: '1', empty_group: '1' },

  )

})
```
**getChangedData({ group: 'group1' })**
获得column中被标记为“group1”的属性与没有做任何group标记的属性的并集（变化的数据）。 

```
it('group1 getChangedData', () => {

  const c = new GroupData({ data1: 'data1', data2: 'data2', data3: 'data3' })

  c.data1 = '1'

  c.data2 = '1'

  c.data3 = '1'

  c.data4 = '1'

  c.emptyGroup = '1'

  expect(c.getChangedData({ group: 'group1' })).toEqual(

    { data1: '1', data2: '1', data3: '1', empty_group: '1' },

  )

})

it('group2 getChangedData', () => {

  const c = new GroupData({ data1: 'data1', data2: 'data2', data3: 'data3' })

  c.data1 = '1'

  c.data2 = '1'

  c.data3 = '1'

  c.data4 = '1'

  c.emptyGroup = '1'

  expect(c.getChangedData({ group: 'group2' })).toEqual(

    { data3: '1', data4: '1', empty_group: '1' },

  )

})

it('no group getChangedData', () => {

  const c = new GroupData({ data1: 'data1', data2: 'data2', data3: 'data3' })

  c.data1 = '1'

  c.data2 = '1'

  c.data3 = '1'

  c.emptyGroup = '1'

  expect(c.getChangedData()).toEqual(

    { data1: '1', data2: '1', data3: '1', empty_group: '1' },

  )

})
```
**getChangedData({ excludeGroup: 'group1' })**
获得column中没有被标记为“group1”的所有属性（变化的数据）。 

```
it('group1 getChangedData', () => {

  const c = new GroupData({ data1: 'data1', data2: 'data2', data3: 'data3' })

  c.data1 = '1'

  c.data2 = '1'

  c.data3 = '1'

  c.emptyGroup = '1'

  expect(c.getChangedData({ excludeGroup: 'group1' })).toEqual(

    { empty_group: '1' },

  )

})

it('group2 getChangedData', () => {

  const c = new GroupData({ data1: 'data1', data2: 'data2', data3: 'data3' })

  c.data1 = '1'

  c.data2 = '1'

  c.data3 = '1'

  c.emptyGroup = '1'

  expect(c.getChangedData({ excludeGroup: 'group2' })).toEqual(

    { data1: '1', data2: '1', empty_group: '1' },

  )

})

it('no group getChangedData', () => {

  const c = new GroupData({ data1: 'data1', data2: 'data2', data3: 'data3' })

  c.data1 = '1'

  c.data2 = '1'

  c.data3 = '1'

  c.emptyGroup = '1'

  expect(c.getChangedData()).toEqual(

    { data1: '1', data2: '1', data3: '1', empty_group: '1' },

  )

})
```
### dynamicModelBase（动态模型类） 
使用场景：主要用在低代码平台或者其他配置化的页面 
需求：不管用在哪里，我们依然有对表单进行数据提交（是否增量）、数据还原等的需求。 
**举例，远程配置页面：**
物模型的远程配置页面就是通过将后端的接口转换为低代码协议和dynamicModelBase的column。 
**举例，物模型未来的通用基本信息页：**
物模型平台建设后，模型可能有上百个属性，我们都要提前声明好吗？对于物模型的基本信息的编辑，低代码协议结合ModelBase是最适合不过了。 
**dynamic column的示例：**
column中的name作为key，下面就是我们常用的列表接口的dynamic column。 
如data其实就是@Column({ name: 'data', model: XXX }) 
如result_list其实就是@Column({ name: 'result_list', autowired: true, model: XXX }) 

```
const columns = {

  data: {

    type: 'object',

    model: {

      result_list: {

        type: 'array',

        autowired: true,

        model: {

          id: {

            type: 'number'

          },

          model: {

            type: 'string'

          },

          worksheet_level: {

            type: 'number'

          },

          worksheet_name: {

            type: 'string'

          },

          map_rule: {

            type: 'number'

          },

          active: {

            type: 'boolean'

          },

          assignee_type: {

            type: 'number'

          }

        }

      },

      total_results: {

        type: 'number'

      }

    }

  },

  result_code: {

    type: 'string'

  },

  message: {

    type: 'string'

  }

}
```
#### 如何创建dynamicModelBase 
写法比较特殊，需要多观察小地图，我自己也经常写错。 

```
const model1 = new (dynamicModelBase(columns))({

  data: {

    result_list: [{

      id: 'shuai meng1'

    }, {

      id: 'shuai meng2'

    }],

    total_results: 10

  },

  result_code: 'success'

})
```
我们可以正常使用ModelBase上面的方法。 

```
model1.saveChangedData()

(model1 as any).data.result_list[0].id = 'shuai meng4'

model1.revertChangedData()
```
### 数据方法 
#### ModelBase Method Api 
#### **callMethod**
**version: 1.7.6以上**
执行ModelBase内部的方法以及DataModel中声明的方法（递归调用，优先叶子节点）。 
两种调用方式。一个是静态方法（可以传入一个ModelBase的数组实例），一个是实例方法。 

```
// 数组ModelBase

const deviceAuthDataFields: [] as DeviceAuthDataFields[]

ModelBase.callMethod(deviceAuthDataFields, { method: 'convertFieldToView' })



// 对象ModelBase

const deviceAuthData  =new DeviceAuthDataFields()

deviceAuthData.callMethod({ method: 'convertFieldToView' })
```
**示例：执行ModelBase内部的方法**

```
class DeviceAuthDataFields extends ModelBase {

  // 初始化的时候赋值，也可以被外部直接调用。

  public convertFieldToView() {

    this.read = this.authOperator ? this.authOperator.indexOf('r') !== -1 : false

    this.write = this.authOperator ? this.authOperator.indexOf('w') !== -1 : false

  }



  public convertViewToField() {

    if (this.read && !this.write) {

      this.authOperator = '-r'

    }

    if (!this.read && this.write) {

      this.authOperator = 'w-'

    }

    if (this.read && this.write) {

      this.authOperator = 'rw'

    }

    this.authOperator = '--'

  }



  @Column()

  public field!: string



  @Column()

  public authOperator!: string



  @Column({ group: 'view' })

  public read!: boolean



  @Column({ group: 'view' })

  public write!: boolean

}
```
调用convertFieldToView方法，让数据满足页面的使用。 

```
pageData.deviceAuthDataFields = [

  new DeviceAuthDataFields({ field: 1, authOperator: '-r' }),

  new DeviceAuthDataFields({ field: 2, authOperator: 'w-' }),

  new DeviceAuthDataFields({ field: 3, authOperator: 'rw' }),

  new DeviceAuthDataFields({ field: 4, authOperator: '--' }),

  new DeviceAuthDataFields({ field: 5, authOperator: '' }),

  new DeviceAuthDataFields({ field: 6 }),

]

ModelBase.callMethod(pageData.deviceAuthDataFields, { method: 'convertFieldToView' })
```
**示例：执行DataModel中声明的方法。**
对Consumer注入"changeUserName"函数表达式，通过callMethod来调用执行。 

```
@DataModel({

    methods: {

      changeUserName: '{{$model.userName = "new Name"}}',

    },

  },

)

export class Consumer extends ModelBase {

  @Column({ trim: true })

  public userName?: string

}
```

```
const c = new Consumer()

c.callMethod({ method: 'changeUserName' })

// c.userName 的值被改变
```
#### **revertChangedData**
还原数据到上一次调用saveChangedData或者初始化状态。 
#### **isChanged**
当前对象是否发生变更 
遍历范围：当前对象通过@Column声明的字段 
目前是通过变量当前对象的所有key对应的值来对比，复杂对象通过stringfy去简单对比。 
使用场景： 
按钮是否会置灰。 
#### **getChangedData({trim: boolean})**
遍历范围：当前对象通过@Column声明的字段 
获取当前对象中变化的键值对。 
使用场景： 
表单的增量提交。 
##### trim举例： 
主要是在国外，输入框的数据需要输入去除两端空格，但是国外经常需要输入空格，在组件上处理不是很合适，所以需要在提交数据的时候统一去除空格。 
###### 定义模型中的trim 
数据中是值都是包括空格的。 

```
export class Consumer extends ModelBase {

  @Column({ trim: true })

  public userName?: string

}





const c = new Consumer(

  {

    userName: ' shuai.meng ',

    consumerList: [{ name: ' shuai.meng ' }],

    consumerObject: { name: ' shuai.meng ' }

  }

)
```
###### trim getCleanSerializableObject 
结果去除了两端空格 

```
expect(c.getCleanSerializableObject({ trim: true })).toEqual(

  {

    user_name: 'shuai.meng',

    consumer_list: [{ name: 'shuai.meng' }],

    consumer_object: { name: 'shuai.meng' }

  }

)
```
###### trim getSerializableObject 
结果去除了两端空格 

```
expect(c.getSerializableObject({ trim: true })).toEqual(

  {

    user_name: 'shuai.meng',

    list: [],

    consumer_list: [{ name: 'shuai.meng' }],

    consumer_object: { name: 'shuai.meng' }

  }

)
```
###### trim getChangedData 
结果去除了两端空格 

```
c.userName = ' shuai '

c.consumerList[0].name = ' shuai '

c.consumerObject.name = ' shuai '

c.userName = ' shuai '

expect(c.getChangedData({ trim: true })).toEqual(

  {

    user_name: 'shuai',

    consumer_list: [{ name: 'shuai' }],

    consumer_object: { name: 'shuai' }

  }

)
```
#### **saveChangedData**
将变化清空，下次调用**isChanged**返回值是false。调用**getChangedData**返回是{} 
使用场景： 
初始化有一些数据是通过异步获取的，但是这些数据不想被**getChangedData**拿到。 
#### **getOriginalData**
遍历范围：当前对象通过@Column声明的字段。 
获取调用过saveChangedData的数据或者初始化的input流向数据。 
使用场景： 
new Model(this.getOriginalData())。 
#### **getCleanSerializableObject**
获取可以被序列化的json对象，但是会自动去除：''、[]、{} 。 
##### trim举例：同上 
#### **getCleanSerializableString**
获取可以被序列化的json字符串，但是会自动去除：''、[]、{}。 
##### trim举例：同上 
#### **getSerializableObject({camelCase: boolean})**
获取可以被序列化的json对象。 
参数： 
camelCase：获取output流向数据的key是否强制转换为驼峰命名。 
emptyValue: 暂未开放，待完善。 
使用场景： 
全量提交表单。 
##### trim举例：同上 
#### **getSerializableString**
获取可以被序列化的json字符串。 
##### trim举例：同上 
#### **getChangedDescriptor**
可以获取到数组里面对象的变化详情。 
详见：column中的prime说明。 
##### trim举例：同上 
#### **extend(model: any)**
遍历范围：当前对象通过@Column声明的字段 
对通过ModelBase实例化的数据进行合并，不会触发formatter，merge行为是deepmerge。 
#### **setColumnData**
一般用于遍历设置列数据，避免出现类型检查的错误提示。 

```
c.setColumnData('userName', undefined)
```
#### **getColumnData**
一般用于遍历获取列数据 
#### update 
动态更新一些数据，入参是输入流向数据。 
使用场景： 
服务端socket通信后只是更新局部数据。没有经过大规模验证，慎用。 
#### isModelEqual(targetData: ModelBase, params?: { ignoreEmptyString?: boolean }) 

- targeData: 比较的目标对象。
- params: 可选
   - ignoreEmptyString：如果设置true并且当前值和目标值存在undefined的情况下，会视为''和undefined为相等。

遍历范围：当前对象通过@Column声明的字段 
比较两个实例化的对象是否相等（一般常见于同一个模型的不同实例）。 

```
model2.isModelEqual(model1)
```
#### isContainsModel 

- targeData: 比较的目标对象。
- params: 可选
   - ignoreEmptyString：如果设置true并且当前值和目标值存在undefined的情况下，会视为''和undefined为相等。

遍历范围：当前对象通过@Column声明的字段 
比较两个对象是否是包含关系，算法说明： 

- 如果目标值为undefined，则认为是包含关系。
- 如果目标值不为undefined，但是和原来的值不相等，则认为是不包含（一般常见于同一个模型的不同实例）。

```
model2.isContainsModel(model1)
```
使用场景： 
远程配置页面下发配置后，判断服务端返回的数据是否符合期待，如果返回的值和其他的值不一样，肯定是一个不包含行为。 
#### setDataByOriginal(dto: any, options?: {keepBackUp?: boolean}) 

- dto: input数据，后端返回的数据。
- options
   - keepBackUp（或者叫keepStatus好一些）：如果为true，则不会更新saved的状态。getChanged方法可以获取到这些数据的变化。如果为false，通过当前方法赋值后再调用getChanged会返回为{}，内部会调用saveChangedData方法。

使用场景： 
比较少见。
#### 新增 group，callMethod，DataModel
![image.png](https://cdn.nlark.com/yuque/0/2023/png/29807260/1691657572741-a2f33575-89de-4ef2-8fb4-139dde6c99c0.png#averageHue=%23fafaf8&clientId=u0352c5dc-9505-4&from=paste&height=3241&id=u166728a1&originHeight=2917&originWidth=864&originalType=binary&ratio=1&rotation=0&showTitle=false&size=651947&status=done&style=none&taskId=u30b1f722-e221-4998-98db-4f4b7b355ab&title=&width=960.0000254313157)
