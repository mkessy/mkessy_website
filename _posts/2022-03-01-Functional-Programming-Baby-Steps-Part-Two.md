---
layout: post
author: mepuka
---

In a [previous](https://dev.to/mkessy/functional-programming-baby-steps-options-and-eithers-1mjf) post I introduced two type classes (actually they're [monads](https://en.wikipedia.org/wiki/Monad_(functional_programming)) but that's not for now) the `Option` type and `Either` type. These types are extremely useful abstractions for dealing with operations that may fail. The former gives us no information about the failure just an empty `None` while the later gives us a `Left` type containing some information about the failure (like an error message.)

##### The Option and Either Types
```js
type Option<A> =
  | { type: 'None' } // our operation failed
  | { type: 'Some'; value: A } // our operation succeeded and we have a value of type A

type Either<L, A> =
  | { type: 'Left'; left: L } // holding a failure
  | { type: 'Right'; right: A } // holding a success
```

Ok these are useful but are hardly a comprehensive model for the types of data and operations we might encounter while web programming. One ubiquitous type of operation that cannot be avoided are those that are not synchronous -- an asynchronous operation. This could be an operation fetching a webpage, an operation connecting to a database, or even a series of synchronous operations that are resource intensive and may take awhile to complete.

In TypeScript/JavaScript we have an abstraction that deals with such operations called a Promise. As described in the MDN web docs:

> The `Promise` object represents the eventual completion (or failure) of an asynchronous operation and its resulting value.

They also provide a handy diagram to help think through the control flow of a Promise and its differing states.

![Flow chart for a typical Promise](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/4n9xnpr6wg4533qb9pdm.png)

As you can see there is a lot going on here. What's more is you can chain promises together so imagine pasting this same diagram everywhere you see a `.then.` This complexity can be difficult to work through especially as the `Promise` chain grows and you start to encounter nested call backs. In extreme cases it can lead to what's known as [callback hell](https://www.google.com/search?q=call+back+hell&oq=call+back+hell&aqs=chrome..69i57j0i10i512l3j0i10i22i30l4j0i390l2.2338j0j7&sourceid=chrome&ie=UTF-8).
 
For this reason [async/await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function) syntax was introduced. It helps avoid `Promise` chain hell and makes our code look more synchronous. Unfortunately we still run into the problem of having to constantly `await` promise-based values before we can operate on them. Further more those awaited Promises could reject and so we need to explicitly wrap them in `Try Catch Finally` blocks or chain `.catch` and `.finally` callbacks. 

But there's another way we can think about asynchronous operations that might help us escape some of the complexity of Promises.

##### The `Task` Type
In [fp-ts](https://gcanti.github.io/fp-ts/) a `Task` is defined as 

```js
interface Task<A> {
  (): Promise<A>
}
```

`Task<A>` represents an asynchronous computation that yields a value of type A and **never fails.** And while this is just a wrapped `Promise` the stipulation that this operation can never fail is a subtly powerful contract if we adhere to it. Knowing that it won't fail means that `Task<Whatever>` is always going to return a `Whatever`.

Now how useful is this really? Unfortunately in the real world we're often working with operations that fail, especially those that are asynchronous. So how do we represent _async operations that **can** fail?_ Well we know how to represent async operations with `Task` and we know how to represent operations that can yield a failure value with `Either`.

```js
interface TaskEither<E, A> extends Task<Either<E, A>> {}
```
So a `TaskEither` is just a `Task` that is *guaranteed* to yield an `Either` value. In other words it is a `Promise` with only a resolve path. Instead of rejecting we store the failure value in the `Left` type of the `Either` sum type.

Initially this concept was confusing to me as it seemed like a bit of hack to just ignore an entire part of the `Promise` API. But if we look at the flow diagram above it's clear how simplifying this abstraction can be. We no longer have to deal with the Reject branch. Instead values corresponding to rejection are contained within the `Either` type.

Let's go back to the example from the previous post. We have an API that returns a list of Users.  

```javascript

// type declaration
declare fetchUsersFromAPI: () => Promise<User[]>

// possible implementation using Axios
function fetchUsersFromApi() {
    return axios.get('https://api.com/users')
}

const newUsers: User[] = await fetchUsersFromAPI();
for (const newUser of newUsers) {
    if(newUser.bio != null) {
        uploadUserBio(newUser.bio);
    }
    // do stuff
}

```   
As we discussed in the previous post this implementation could blow up since we're not catching the promise rejection and even if it doesn't reject the `newUsers` array could be null. 

Let's refactor this and wrap our `fetchUsersFromAPI` in a `TaskEither`. Fp-ts provides us some handy helper functions just for this task. One such function is `tryCatchK` in the `TaskEither` module.

```js

// Converts a function returning a Promise to one returning a TaskEither

declare const tryCatchK: <E, A extends readonly unknown[], B>(
  f: (...a: A) => Promise<B>,
  onRejected: (reason: unknown) => E
) => (...a: A) => TaskEither<E, B>

const fetchUsersTE = tryCatchK(
  fetchUsersFromAPI,
  (reason: unknown) => String(reason)
)
// const fetchUsersTE: () => TaskEither<string, User[]>
```
Rejoice! With this simple change we do not need to handle Promise rejection with clunky `try catch` blocks. 

Remember a `TaskEither<E, A>` is just an alias for `Task<Either<E,A>>`. And we know that  `Task<A>: () => Promise<A>` so `TaskEither<E,A>: () => Promise<Either<E, A>>` That is to say that our `fetchUsersTE` function is a function that returns _another function_ that returns a `Promise` containing an `Either`. Again recall that the contract we signed by using `Task` ensures that the promise it returns will *never* reject. So we can safely 'unwrap' our promise (no try catch block needed) and get to the juicy `Either` within. Then returning to the previous code we can `fold` the `Either` and handle both `Left` and `Right` cases.

```js
const usersTaskEither = fetchUsers();
const usersEither = await usersTaskEither(); 
// Either<string, Users[]> 
// The Task contract ensure this promise will never reject

fold(
  usersEither,
  (error: string) => `Something went wrong ${error}!`,
  (users: Users[]) => {
    for (const newUser of users) {
    if(newUser.bio != null) {
        uploadUserBio(newUser.bio);
      }
  }
})

``` 

##### Final Notes and Next Steps

So there are some caveats. For one we need to be careful when we wrap promises in TaskEither. Referencing the signature for `tryCatch` below there are two things to consider. First, the function `f` should never throw an error since it won't be caught. Any error handling should be abstracted away inside this function. Second, we need to ensure we know when the `Promise` returned by `f` rejects. In our example using the Axios API it will reject for any error HTTP status codes (400-500+). This behavior might be desirable or not. For example it is often the case that we want any non `200` response to be considered an error and put in the `Left` of the `Either`. Axios provides a config option to ensure this behavior. But you should always be clear under what conditions the `Promise` will reject.
```js
declare const tryCatchK: <E, A extends readonly unknown[], B>(
  f: (...a: A) => Promise<B>,
  onRejected: (reason: unknown) => E
) => (...a: A) => TaskEither<E, B>

```

Finally, what can we actually do with this `TaskEither`? Is it just a temporary container to simplify Promises? In the beginning of this post I mentioned that it is a monad. While this term has specific mathematical meaning, for practical purposes we only need to know that this means it implements an interface comprised of a number of functions that allow us to work and manipulate `TaskEither` types.

For example, say I wanted to compute the length of the returned `Users` array. I could extract the value from the `TaskEither` by running the promise, folding the `Either` and finally accessing the `length` property on the array. This is a lot of work. Instead as a monad `TaskEither` implements a function called `map`. `map` is a function that takes a function from `A` to `B` and returns another function from `TaskEither<E, A>` to `TaskEither<E, B>`.

```js
const map: <A, B>(f: (a: A) => B) => <E>(fa: TaskEither<E, A>) => TaskEither<E, B>

const getLength = map((users: User[]) => users.length);

const usersLengthTE = getLength(usersTE);

// const usersLengthTE: TE.TaskEither<string, number>

```
Now we have a function that returns a promise that either returns an error string or the length of the users. All this without ever actually touching the Promise API. Hopefully the gears are starting to spin and you can appreciate how powerful this could be. 

We've only scratched the surface and in future posts we'll start exploring all the functions implemented by the `monad` interface and why it is such a powerful concept. If you can't wait that long (I don't blame you) see below for more in-depth discussion.

- [Getting started with fp-ts](https://dev.to/gcanti/series/680)
- [Mostly Adequate Guide to Functional Programming](https://mostly-adequate.gitbook.io/mostly-adequate-guide/)
- [Functional Programming in TypeScript](https://github.com/enricopolanski/functional-programming)
- [Practical Guide to Fp-ts](https://rlee.dev/practical-guide-to-fp-ts-part-1)