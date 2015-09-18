'use strict';

var clone = require('clone');


// -----------------------------------------------------
// Undo/Redo queue for plots
// -----------------------------------------------------


var queue = {};

// TODO: disable/enable undo and redo buttons appropriately

/**
 * Add an item to the undoQueue for a graphDiv
 *
 * @param gd
 * @param undoFunc Function undo this operation
 * @param undoArgs Args to supply undoFunc with
 * @param redoFunc Function to redo this operation
 * @param redoArgs Args to supply redoFunc with
 */
queue.add = function(gd, undoFunc, undoArgs, redoFunc, redoArgs) {
    var queueObj,
        queueIndex;

    // make sure we have the queue and our position in it
    gd.undoQueue = gd.undoQueue || {index: 0, queue: [], sequence: false};
    queueIndex = gd.undoQueue.index;

    // if we're already playing an undo or redo, or if this is an auto operation
    // (like pane resize... any others?) then we don't save this to the undo queue
    if (gd.autoplay) {
        if (!gd.undoQueue.inSequence) gd.autoplay = false;
        return;
    }

    // if we're not in a sequence or are just starting, we need a new queue item
    if (!gd.undoQueue.sequence || gd.undoQueue.beginSequence) {
        queueObj = {undo: {calls: [], args: []}, redo: {calls: [], args: []}};
        gd.undoQueue.queue.splice(queueIndex, gd.undoQueue.queue.length - queueIndex, queueObj);
        gd.undoQueue.index += 1;
    } else {
        queueObj = gd.undoQueue.queue[queueIndex - 1];
    }
    gd.undoQueue.beginSequence = false;

    // we unshift to handle calls for undo in a forward for loop later
    queueObj.undo.calls.unshift(undoFunc);
    queueObj.undo.args.unshift(undoArgs);
    queueObj.redo.calls.push(redoFunc);
    queueObj.redo.args.push(redoArgs);

};

/**
 * Begin a sequence of undoQueue changes
 *
 * @param gd
 */
queue.startSequence = function(gd) {
    gd.undoQueue = gd.undoQueue || {index: 0, queue: [], sequence: false};
    gd.undoQueue.sequence = true;
    gd.undoQueue.beginSequence = true;
};

/**
 * Stop a sequence of undoQueue changes
 *
 * Call this *after* you're sure your undo chain has ended
 *
 * @param gd
 */
queue.stopSequence = function(gd) {
    gd.undoQueue = gd.undoQueue || {index: 0, queue: [], sequence: false};
    gd.undoQueue.sequence = false;
    gd.undoQueue.beginSequence = false;
};

/**
 * Move one step back in the undo queue, and undo the object there.
 *
 * @param gd
 */
queue.undo = function undo (gd) {
    var queueObj,
        i;

    if(!gd) gd = Tabs.get();  // FIXME

    if(gd.framework && gd.framework.isPolar){
        gd.framework.undo();
        return;
    }
    if (gd.undoQueue === undefined ||
            isNaN(gd.undoQueue.index) ||
            gd.undoQueue.index <= 0) {
        return;
    }

    // index is pointing to next *forward* queueObj, point to the one we're undoing
    gd.undoQueue.index--;

    // get the queueObj for instructions on how to undo
    queueObj = gd.undoQueue.queue[gd.undoQueue.index];

    // this sequence keeps things from adding to the queue during undo/redo
    gd.undoQueue.inSequence = true;
    for (i = 0; i < queueObj.undo.calls.length; i++) {
        queue.plotDo(gd, queueObj.undo.calls[i], queueObj.undo.args[i]);
    }
    gd.undoQueue.inSequence = false;
    gd.autoplay = false;
};

/**
 * Redo the current object in the undo, then move forward in the queue.
 *
 * @param gd
 */
queue.redo = function redo (gd) {
    var queueObj,
        i;

    if(!gd) gd = Tabs.get();  // FIXME

    if(gd.framework && gd.framework.isPolar){
        gd.framework.redo();
        return;
    }
    if (gd.undoQueue === undefined ||
            isNaN(gd.undoQueue.index) ||
            gd.undoQueue.index >= gd.undoQueue.queue.length) {
        return;
    }

    // get the queueObj for instructions on how to undo
    queueObj = gd.undoQueue.queue[gd.undoQueue.index];

    // this sequence keeps things from adding to the queue during undo/redo
    gd.undoQueue.inSequence = true;
    for (i = 0; i < queueObj.redo.calls.length; i++) {
        queue.plotDo(gd, queueObj.redo.calls[i], queueObj.redo.args[i]);
    }
    gd.undoQueue.inSequence = false;
    gd.autoplay = false;

    // index is pointing to the thing we just redid, move it
    gd.undoQueue.index++;
};

/**
 * Called by undo/redo to make the actual changes.
 *
 * Not meant to be called publically, but included for mocking out in tests.
 *
 * @param gd
 * @param func
 * @param args
 */
queue.plotDo = function (gd, func, args) {
    gd.autoplay = true;

    // call the supplied function with a cloned args
    func.apply(null, clone(args));
};

module.exports = queue;
