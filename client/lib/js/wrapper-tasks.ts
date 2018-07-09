"use strict";
// uuid: 57f31321-69a9-4170-96a1-6baac731403b

// ------------------------------------------------------------------------
// Copyright (c) 2018 Alexandre Bento Freire. All rights reserved.
// Licensed under the MIT License+uuid License. See License.txt for details
// ------------------------------------------------------------------------

// Implements a list of built-in wrapper Tasks

/** @module end-user | The lines bellow convey information for the end-user */

/**
 * ## Description
 *
 * A wrapper task calls a story or scene method, allowing for a story
 * to be loaded from JSON file or to be [](teleported).
 *
 * ABeamer has the following built-in wrapper tasks:
 *
 * - `scene-transition` - setup a scene transition.
 *
 * - `add-stills` - adds stills to the scene pipeline.
 *
 * - `add-flyover` - adds a flyover to the story.
 *
 * - `add-vars` - adds variables to be used by expressions.
 */
namespace ABeamer {

  // #generate-group-section
  // ------------------------------------------------------------------------
  //                               Text Tasks
  // ------------------------------------------------------------------------

  // The following section contains data for the end-user
  // generated by `gulp build-definition-files`
  // -------------------------------
  // #export-section-start: release

  export type WrapperTaskName =
    /** @see #SceneTransitionTaskParams */
    | 'scene-transition'
    /** @see #AddStillsTaskParams */
    | 'add-stills'
    /** @see #AddFlyoverTaskParams */
    | 'add-flyover'
    /** @see #AddVarsTaskParams */
    | 'add-vars'
    ;


  export type WrapperTaskParams =
    | SceneTransitionTaskParams
    | AddStillsTaskParams
    | AddFlyoverTaskParams
    | AddVarsTaskParams
    ;


  export interface SceneTransitionTaskParams extends AnyParams {
    handler?: TransitionHandler;
    duration?: TimeHandler;
  }


  export interface AddStillsTaskParams extends AnyParams {
    duration: TimeHandler;
  }


  export interface AddFlyoverTaskParams extends AnyParams {
    handler: FlyoverHandler;
    params?: FlyoverParams;
  }


  /**
   * Adds multiple variables to `args.vars`.
   * Variables can be:
   *
   * - textual, numerical and arrays.
   * - object variables of the above types.
   *
   * ## Example
   *
   * ```typescript
   * tasks: [{
   *    handler: 'add-vars',
   *    params: {
   *      vars: {
   *        'prop1': 'changes the args.vars.prop1',
   *        'obj1.prop2': 'creates an object obj1 in vars, set prop2',
   *        'over.about.blue': 'creates obj over.about.sets prop blue',
   *      },
   *    }
   * }]
   * ```
   */
  export interface AddVarsTaskParams extends AnyParams {
    /** If false, it won't overwrite the previous value */
    overwrite?: boolean;
    /**
     * Object with name: value of all the variables to add to `args.vars`.
     */
    vars: { [varName: string]: string | number | number[] };
  }

  // #export-section-end: release
  // -------------------------------

  // ------------------------------------------------------------------------
  //                               SceneTransition Task
  // ------------------------------------------------------------------------

  _taskFunctions['scene-transition'] = _SceneTransitionTask;

  /** Implements the Scene Transition Task */
  function _SceneTransitionTask(anime: Animation, wkTask: WorkTask,
    params: SceneTransitionTaskParams,
    stage: uint, args?: ABeamerArgs): TaskResult {

    switch (stage) {
      case TS_TELEPORT:
        let handler = params.handler;

        if (typeof handler === 'number') {
          handler = StdTransitions[handler];
        } else {
          throwIfI8n(typeof handler === 'function', Msgs.NoCode);
        }

        params.handler = handler;
        return TR_EXIT;

      case TS_INIT:
        args.scene.transition = {
          handler: params.handler,
          duration: params.duration,
        };
        return TR_EXIT;
    }
  }

  // ------------------------------------------------------------------------
  //                               AddStills
  // ------------------------------------------------------------------------

  _taskFunctions['add-stills'] = _addStillsTask;

  /** Implements the Add Stills Task */
  function _addStillsTask(anime: Animation, wkTask: WorkTask,
    params: AddStillsTaskParams,
    stage: uint, args?: ABeamerArgs): TaskResult {

    switch (stage) {
      case TS_INIT:
        args.scene.addStills(params.duration);
        return TR_EXIT;
    }
  }

  // ------------------------------------------------------------------------
  //                               AddFlyover
  // ------------------------------------------------------------------------

  _taskFunctions['add-flyover'] = _addFlyover;

  /** Implements the Add Flyover Task */
  function _addFlyover(anime: Animation, wkTask: WorkTask,
    params: AddFlyoverTaskParams, stage: uint, args?: ABeamerArgs): TaskResult {

    switch (stage) {
      case TS_INIT:
        args.story.addFlyover(params.handler, params.params);
        return TR_EXIT;
    }
  }

  // ------------------------------------------------------------------------
  //                               AddVars
  // ------------------------------------------------------------------------

  _taskFunctions['add-vars'] = _addVarsTask;

  /** Implements the Add Vars Task */
  function _addVarsTask(anime: Animation, wkTask: WorkTask,
    params: AddVarsTaskParams, stage: uint, args?: ABeamerArgs): TaskResult {

    switch (stage) {
      case TS_INIT:
        const vars = params.vars || {};
        const overwrite = params.overwrite !== false;
        Object.keys(vars).forEach(varName => {
          const varParts = varName.split('.');
          let argsPointer = args.vars as AnyParams;
          let objPartName = varParts.shift();
          while (varParts.length) {
            argsPointer[objPartName] = argsPointer[objPartName] || {};
            argsPointer = argsPointer[objPartName];
            objPartName = varParts.shift();
          }
          if (overwrite || argsPointer[objPartName] === undefined) {
            argsPointer[objPartName] = vars[varName];
          }
        });
        return TR_EXIT;
    }
  }
}
