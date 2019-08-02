const { data, any, string } = require("@algebraic/type");
const Optional = require("@algebraic/type/optional");
const union = require("@algebraic/type/union-new");
const inspect = Symbol.for("nodejs.util.inspect.custom");

const Task = union `Task` (
    is      =>  Task.Waiting,
    or      =>  Task.Active,
    or      =>  Task.Completed );

Task.Active = union `Task.Active` (
    is      =>  Dependent.Blocked,
    or      =>  Dependent.Unblocked,
    or      =>  Independent.Running );

Task.Failure = union `Task.Failure` (
    is      =>  Task.Failure.Direct,
    or      =>  Task.Failure.Aggregate );

Task.Failure.Direct = data `Task.Failure.Direct` (
    name    =>  Task.Identifier,
    value   =>  any );

Task.Failure.Aggregate = data `Task.Failure.Aggregate` (
    name    =>  Task.Identifier,
    value   =>  any );

Task.Success = data `Task.Success` (
    name    => Task.Identifier,
    value   => value );

Task.Completed = union `Task.Completed` (
    is  =>  Task.Success,
    or  =>  Task.Failure );



Task.Identifier = Optional(string);

module.exports = Task;


const TaskReturningSymbol = Symbol("@cause/task:task-returning");

Task.taskReturning = f => Object.assign(f, { [TaskReturningSymbol]: true });
Task.isTaskReturning = f => !!f[TaskReturningSymbol];

const Dependent = require("./dependent");
const Independent = require("./independent");

Task.Waiting = Independent.Waiting;

function toPromiseThen(onResolve, onReject)
{
    return require("@cause/cause/to-promise")(Object, this).then(onResolve, onReject);
}

function toPromiseCatch(onReject)
{
    return require("@cause/cause/to-promise")(Object, this).catch(onReject);
}

for (const type of [
    Independent.Waiting,
    Independent.Running,
    Dependent.Blocked,
    Dependent.Unblocked,
    //...union.components(Independent),
    //...union.components(Dependent),
    ...union.components(Task.Failure),
    Task.Success])
{console.log(type);
    type.prototype.then = toPromiseThen;
    type.prototype.catch = toPromiseCatch;
}


Task.fromAsync = function (fAsync)
{
    return Task.taskReturning((...args) =>
        Task.fromAsyncCall(null, fAsync, args));
}

Task.fromAsyncCall =
Task.fromResolvedCall = function (self, fUnknown, args = [])
{
    const start = function start (push)
    {
        // Even if f was known to be a Promise-returning function, it can still
        // throw during the initial calling phase and thus not be handled by
        // .catch.
        (async function ()
        {
            push(Started);

            if (process.env.TASK_DEBUG)
                console.log("IN HERE FOR " + fUnknown);

            push(Task.Success({ value: await fUnknown.apply(self, args) }));
        })().catch(error => push(Task.Failure({ error })));
    };

    start.toString = function () { return (fUnknown+"").substr(0,100); }
    start[inspect] = function () { return (fUnknown+"").substr(0,100); }
    const cause = Cause(any)({ start });

    return Task.Initial({ cause });
}
