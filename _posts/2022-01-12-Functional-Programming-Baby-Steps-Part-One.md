---
layout: post
author: mepuka
---
One of the first issues I ran into as I began my journey into the world of TypeScript was the annoying issue of [null checks](https://dev.to/jamesmh/unhealthy-code-null-checks-everywhere-2720). On one hand the TypeScript compiler is reminding you of something important: "You might encounter a runtime error if you try and do something with this possibly null value." On the other hand it can lead to some really ugly code where we need nested conditionals to ensure that the data we want to operate on actually exists as we expect it to.

```javascript
interface User { 
  id: number;
  name: string;
  bio: string;
}

// this is allowed in TypeScript
const newUser: User = {id: null, name: null, bio: null};
let userBio: string;

if(newUser != null) {
    if(newUser.id != null) {
        if(newUser.bio != null) {
            userBio = newUser.bio;
        } else {
            userBio = "N/A";
        }
    } else {
        useBio = "N/A"
    }
} else {
    userBio = "N/A"
}

```

This is ugly, hard to read, and unsafe (eventually we'll make a mistake or forget a conditional and something will blow up.) Now consider that this problem becomes even worse when performing routine operations such as fetching data from a remote API. What if we needed to fetch a list of users and process them in some way? Fetching remote data is an asynchronous task that is not guaranteed succeed. So now in addition to all the null checking we'll need to check whether our fetch operation was even successful or if it returned an error.

```javascript
// this code may blow up since not only may the fetch operation
// fail but it could succeed and return a null newUsers array 
const newUsers: User[] = await fetchUsersFromAPI();
for (const newUser of newUsers) {
    if(newUser.bio != null) {
        uploadUserBio(newUser.bio);
    }
}
```

## Functional Programming to the Rescue

Functional programming is useful here because it offers us a number of abstractions that force us to write code that accounts for cases where an operation fails or returns a value that may be null or undefined. (For all the following examples I'm going to be using the excellent functional programming library.) [fp-ts](https://github.com/gcanti/fp-ts) 

### The `Option` type
The option types helps us abstract the common case in which a computation may fail (or return null) _or_ return a value of type A. In fp-ts it is represented by the sum type:

```javascript
type Option<A> =
  | { type: 'None' } // our operation failed
  | { type: 'Some'; value: A } // our operation succeeded and we have a value of type A

```
Fp-ts provides us with a number of built-in methods for operating with this new type.

```javascript
// construct for a null or none type
const none: Option<never> = { type: 'None' }
//constructor for a value that actually exists
const some = <A>(value: A): Option<A> => ({ type: 'Some', value })
//an operation to 'match' an expression 
const fold = <A, R>(fa: Option<A>, onNone: () => R, onSome: (a: A) => R): R =>
  fa.type === 'None' ? onNone() : onSome(fa.value)
```

Wrapping a value in an `Option` forces us to deal with the case in which the value doesn't exist or is not what we want.

```javascript
// if our API had the following signature 
// (we'll learn later about how to implement this)
declare fetchUsersFromAPI: () => Promise<Option<User[]>>

// then we're forced to 'unwrap' the Option and deal with the
// case in which in may be null or an error

const newUsers: Option<User[]> = await fetchUsersFromAPI();

fold(
  newUsers,
  () => 'There are no users!',
  (users) => {
    for (const newUser of users) {
    if(newUser.bio != null) {
        uploadUserBio(newUser.bio);
      }
  }
})
```

So now the type system and anyone who wants to operate on the `newUsers` array will be forced to deal with the fact that `newUsers` may not exist.

### The `Either` type

```javascript
type Either<L, A> =
  | { type: 'Left'; left: L } // holding a failure
  | { type: 'Right'; right: A } // holding a success

const fold = <L, A, R>(
  fa: Either<L, A>,
  onLeft: (left: L) => R,
  onRight: (right: A) => R
): R => (fa.type === 'Left' ? onLeft(fa.left) : onRight(fa.right))

```

The `Either` type is similar to the `Option` type but it can hold more information about _why_ our operation failed if it indeed does. Usually the `Left` value holds an error while the `Right` value holds a successfully retrieved value.

Let's again consider the fetch operation from the previous example now refactored (again we'll defer implementation of the fetch function to another post) to return an `Either`

```javascript
// the new function signiture returning an Either 
declare fetchUsersFromAPI: () => Promise<Either<string, User[]>>

const newUsers: Either<string, User[]> = await fetchUsersFromAPI();

fold(
  newUsers,
  (m: string) => `Something went wrong ${m}!`,
  (users) => {
    for (const newUser of users) {
    if(newUser.bio != null) {
        uploadUserBio(newUser.bio);
      }
  }
})
```

In the above example we have a `string` containing a message as our `Left` value in the event of an error. We could choose to implement this in anyway we want however. We could return an `Error` instance containing more detailed information about what went wrong. Regardless, as with the `Option` anyone who wants to use the newUsers object will need to account for the possibility that the fetch operation failed.

### Is any of this worth the hassle?

These are simple examples so far. It may not seem worth it to implement `Options` and `Eithers` when a simple `if` check could suffice. The point so far however is to understand that we have much to gain by treating certain classes of data as existing in a dual state (like a [superposition](https://en.wikipedia.org/wiki/Quantum_superposition) in physics). Instead of pretending that a piece of data fetched from a remote API will always represent the data we want (oh if it were so) we can use abstractions like `Option` and `Either` such that the possibility that they don't is considered as a matter of course. This will make our code not only more robust, but also easier to read and more fun to write.

### Further reading

In future posts I'll explore more complex examples and how we can start implementing API fetching functions that use `Options`, `Eithers` and other FP abstractions we haven't explored yet.

This is a complex topic. Here are some resources I've found useful:

- [Getting started with fp-ts](https://dev.to/gcanti/series/680)
- [Mostly Adequate Guide to Functional Programming](https://mostly-adequate.gitbook.io/mostly-adequate-guide/)
- [Functional Programming in TypeScript](https://github.com/enricopolanski/functional-programming)
- [Practical Guide to Fp-ts](https://rlee.dev/practical-guide-to-fp-ts-part-1)


