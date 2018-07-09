"use strict";
// uuid: 3b581118-d68b-4f8e-8663-99ec6d761d04

// ------------------------------------------------------------------------
// Copyright (c) 2018 Alexandre Bento Freire. All rights reserved.
// Licensed under the MIT License+uuid License. See License.txt for details
// ------------------------------------------------------------------------

// Implements story class


/** @module end-user | The lines bellow convey information for the end-user */

/**
 * ## Description
 *
 * A **story** is the entry point of ABeamer web browser library.
 * It has the following functions:
 *
 * - Manage multiple scenes, including insert and remove.
 * - Manage scene transitions.
 * - Manage flyovers.
 * - Start the rendering process.
 * - Communicate with the render server agent.
 * - Load the complete story from a configuration file.
 *
 * The workflow summary is:
 *
 * - A story automatically creates DOM scenes.
 * - In each scene, the user adds its animations.
 * - The user executes `story.render` which will process the animation pipeline
 * frame by frame and sends it to the render server agent.
 * - The render server agent will communicate with a headless server such as puppeteer
 * to store each frame on the disk.
 *
 * @see workflow
 */
namespace ABeamer {

  // #generate-group-section
  // ------------------------------------------------------------------------
  //                               Story
  // ------------------------------------------------------------------------

  // The following section contains data for the end-user
  // generated by `gulp build-definition-files`
  // -------------------------------
  // #export-section-start: release


  export type DoneFunc = () => void;

  export type WaitFunc = (args: ABeamerArgs, params: AnyParams,
    onDone: DoneFunc) => void;


  export interface WaitMan {
    addWaitFunc(func: WaitFunc, params: AnyParams): void;
  }


  export type DirectionInt = -1 | 1;


  export type LogType = 0 | 1 | 2;


  /** Scene by Object, index or name */
  export type SceneHandler = Scene | uint | string;


  export interface StoryMetadata {
    version?: string;
    author?: string;
    email?: string;
    copyrights?: string;
    categories?: string[];
    keywords?: string[];
    comments?: string[];
    rating?: uint;
    /** ISO DateTime stamp of the creation time. */
    createdDateTime?: string;
    /** ISO DateTime stamp of the last modified time. */
    modifiedDateTime?: string;
  }


  /** Parameters passed to the story when it's created */
  export interface CreateStoryParams {
    /** Adds automatically the default scenes. */
    dontAddDefaultScenes?: boolean;


    /** Defines if the story is going to be teleported. */
    toTeleport?: boolean;


    /**
     * Set this value, if you need use a Virtual Story Adapter inside of the
     * default DOM Adapter.
     */
    storyAdapter?: SceneAdapter;
  }


  /**
   * ABeamer still has to render all the previous frames
   * of active scene bypassing the middle frames,
   * but it won't be render to disk and it will bypass any unnecessary frames.
   */
  export interface RenderFrameOptions {
    /**
     * First render frame.
     * If `startScene` isn't defined it will be relative to the story, otherwise is
     * relative to the `startScene`.
     *
     * @default 0
     */
    renderPos?: TimeHandler;


    /**
     * Total number of frames to render.
     *
     * **EXPERIMENTAL** Use a negative value to render backwards.
     * For backward rendering, ABeamer first has to consume all the frames forward,
     * bypassing all middle frames, only after can render backwards.
     *
     * @default the total number of frames
     */
    renderCount?: TimeHandler;


    /**
     * First scene to be rendered.
     * Before start rendering the `startScene`, first,
     * ABeamer first has to consume all the frames until it reaches the
     * beginning of Scene.
     * Accepts by 'Scene Zero-Based Index', 'Name' or by 'Scene Object'
     */
    startScene?: SceneHandler;


    /**
     * Last scene to be rendered.
     * Accepts by 'Scene Zero-Based Index', 'Name' or by 'Scene Object'.
     */
    endScene?: SceneHandler;
  }

  // #export-section-end: release
  // -------------------------------

  // ------------------------------------------------------------------------
  //                               Implementation
  // ------------------------------------------------------------------------

  export interface _WaitFunc {
    func: WaitFunc;
    params: AnyParams;
  }

  export class _WaitMan implements WaitMan {

    funcs: _WaitFunc[] = [];
    pos: uint = 0;

    addWaitFunc(func: WaitFunc, params: AnyParams): void {
      this.funcs.push({ func, params });
    }
  }



  interface _RenderFrameOptionsEx extends RenderFrameOptions {
    playSpeedMs?: uint;
  }


  /**
   * Implementation of _Story class.
   */
  export class _Story implements _StoryImpl {

    // protected
    protected _isServerReady: boolean = false;

    protected _width: uint = 0;
    protected _height: uint = 0;

    protected _frameCount: uint = 0;
    protected _frameCountChanged: boolean = false;

    protected _renderFramePos: uint = 0;
    protected _renderDir: -1 | 1 = 1;
    protected _renderFrameEnd: uint = 0;
    protected _renderFrameCount: uint = 0;

    protected _renderStage: uint = 0;
    protected _renderPlaySpeed: uint = 0;
    protected _renderTimeStamp: Date;
    protected _renderHiddenStory: boolean;

    protected _isRendering: boolean = false;
    protected _scenes: _SceneImpl[] = [];
    protected _curScene: _SceneImpl | undefined = undefined;

    protected _renderTimer: number | undefined;

    protected _wkFlyovers: _WorkFlyover[] = [];

    protected _queueRenders: _RenderFrameOptionsEx[] = [];

    protected _isTeleporting: boolean;

    protected _metadata: StoryMetadata = {};


    _teleporter: _Teleporter;
    _waitMan: _WaitMan;

    // scene access
    _args: ABeamerArgs = {
      renderNr: 0,
      stage: AS_UNKNOWN,
      vars: _vars,
      renderVars: {},
    };


    // public
    /**
     * Frames per second.
     * All the time values is converted into frames using this value.
     * Defined during the call to `createStory`.
     *
     * #end-user @readonly
     */
    fps: uint;


    /**
     * Default unit used when input time values are used in numeric forms.
     * Supports minutes, seconds, milliseconds and frames.
     *   `TimeUnit.f = 0;`
     *   `TimeUnit.ms = 1;`
     *   `TimeUnit.s = 2;`
     *   `TimeUnit.m = 3;`
     */
    defaultUnit: TimeUnit = TimeUnit.f;


    /**
     * True if it's running a supporting server program for frame storage.
     *
     * #end-user @readonly
     */
    hasServer: boolean = false;


    /**
     * The name of the server.
     * The server will assign this property value.
     *
     * #end-user @readonly
     */
    serverName: string;


    /**
     * Provides information about the running server.
     */
    serverFeatures: ServerFeatures;


    /**
     * Numerical value of the frame width in pixels.
     *
     * #end-user @readonly
     */
    get metadata(): StoryMetadata {
      return this._metadata;
    }


    /**
     * Numerical value of the frame width in pixels.
     *
     * #end-user @readonly
     */
    get width(): uint {
      return this._width;
    }


    /**
     * Numerical value of the frame height in pixels.
     *
     * #end-user @readonly
     */
    get height(): uint {
      return this._height;
    }


    /**
     * Total number of frames from all the scenes.
     *
     * #end-user @readonly
     */
    get frameCount(): uint {
      this._calcFrameCount();
      return this._frameCount;
    }


    /**
     * Render direction. 1 for forward, -1 for backwards.
     * Defined during the call to `story.render`.
     *
     * #end-user @readonly
     */
    get renderDir(): DirectionInt { return this._renderDir; }


    /**
     * The number of the last frame to be rendered within the story.
     * Defined during the call to `story.render`.
     * This value doesn't changes during the rendering process.
     *
     * #end-user @readonly
     */
    get renderFrameEnd(): uint { return this._renderFrameEnd; }


    /**
     * The number of the current frame being rendered.
     * Defined during the call to `story.render`.
     * This value changes during the rendering process.
     *
     * #end-user @readonly
     */
    get renderFramePos(): uint { return this._renderFramePos; }


    /**
     * The number of the current frame being rendered.
     * Defined during the call to `story.render`.
     * This value doesn't changes during the rendering process.
     *
     * #end-user @readonly
     */
    get renderFrameCount(): uint { return this._renderFrameCount; }


    /**
     * True if the rendering has started.
     * Use `finishRender` to abort the rendering process.
     *
     * #end-user @readonly
     */
    get isRendering(): boolean { return this._isRendering; }


    /**
     * True if it's teleporting.
     *
     * #end-user @readonly
     */
    get isTeleporting(): boolean { return this._isTeleporting; }


    /**
     * Returns ABeamerArgs.
     * This should be used only in specific cases such the access to renderVars.
     * In most cases, this property is passed as an argument to plugins and callbacks.
     *
     * #end-user @readonly
     */
    get args(): ABeamerArgs { return this._args; }


    /**
     * If true, the input parameters have strict checks and throw errors if fails.
     * If false, ABeamer is more relax and bypasses errors.
     * The server can modify this mode on startup.
     *
     * @default false
     */
    _strictMode: boolean = false;


    get strictMode(): boolean {
      return this._strictMode;
    }


    set strictMode(newStrictMode: boolean) {
      this._strictMode = newStrictMode;
      this._args.isStrict = newStrictMode;
    }


    /**
     * Defines the log level. Use `LL_VERBOSE` for debugging.
     * The server can modify this mode.
     */
    _logLevel: uint = 0;


    get logLevel(): uint { return this._logLevel; }

    set logLevel(newLogLevel: uint) {
      this._logLevel = newLogLevel;
      this._isVerbose = newLogLevel >= LL_VERBOSE;
      this._args.isVerbose = this._isVerbose;
    }

    _isVerbose: boolean;

    get isVerbose(): boolean { return this._isVerbose; }


    /**
     * List of the scenes.
     *
     * #end-user @readonly
     */
    get scenes(): Scene[] { return this._scenes as Scene[]; }


    /**
     * Current active and visible scene.
     * Valid both for adding animations and rendering.
     * Use `gotoScene` to change this value.
     *
     * #end-user @readonly
     */
    get curScene(): Scene | undefined { return this._curScene; }


    /**
     * Allows flyovers to find elements on the document body or
     * in the virtual world.
     */
    storyAdapter: SceneAdapter;


    /**
     * If true, it terminates the server
     * when the render call finishes or if it's aborted.
     * For a serverless execution, it has no effect.
     *
     * @default true
     */
    toExitOnRenderFinished: boolean = true;


    // @TODO: Implement the usage of this event
    /**
     * Event triggered when render finished the rendering process.
     * **EXPERIMENTAL** The behavior can changed or be deprecated.
     */
    onRenderFinished?: (args?: ABeamerArgs) => void;


    /**
     * Event triggered by server, stating that it's ready to receive frames.
     * A server is usually a headless capture program such as puppeteer.
     * If the animation is running without server, this event is never fired.
     */
    onServerReady?: (args?: ABeamerArgs) => void;


    /**
     * Event triggered before a frame is rendered.
     */
    onBeforeRenderFrame?: (args?: ABeamerArgs) => void;


    /**
     * Event triggered after a frame is rendered.
     */
    onAfterRenderFrame?: (args?: ABeamerArgs) => void;


    /**
     * Event triggered during the rendering process after a frame is rendered
     * and is ready to move to following frame.
     */
    onNextFrame?: (args?: ABeamerArgs) => void;


    /**
     * Maps Ids into Virtual Elements
     * Used only in non-DOM elements such as WebGL elements.
     *
     * @param id  virtual element Id without '%'
     */
    onGetVirtualElement?: (id: string, args?: ABeamerArgs) => VirtualElement;


    virtualAnimators?: VirtualAnimator[] = [];


    /**
     * Sets up the Story and adds the Default Scenes.
     */
    constructor(cfg: _Config, createParams: CreateStoryParams) {
      _initBrowser();

      const urlParams = window.location.search || '';

      const args = this._args;
      const self = this;
      this._waitMan = new _WaitMan();
      args.waitMan = this._waitMan;

      this.storyAdapter = createParams.storyAdapter || new _DOMSceneAdapter('.abeamer-story');

      cfg.fps = cfg.fps || this.storyAdapter.getProp('fps', args) as uint;
      throwIfI8n(!isPositiveNatural(cfg.fps), Msgs.MustNatPositive, { p: 'fps' });
      _vars.fps = cfg.fps;


      function setDim(srvPropPrefix: string, cfgValue: uint, propName: string): uint {

        let storyNeedsDimUpdate = false;
        let res = cfgValue || self.storyAdapter.getProp(propName, args) as uint;
        if (urlParams) {
          urlParams.replace(new RegExp(srvPropPrefix + '(\\d+)'), (m, p1) => {
            const qsValue = parseInt(p1);
            storyNeedsDimUpdate = qsValue !== res;
            res = qsValue || res;
            return '';
          });
        }

        throwIfI8n(!isPositiveNatural(res), Msgs.MustNatPositive, { p: propName });
        self.storyAdapter.setProp(propName, res, args);
        return res;
      }

      this._width = cfg.width = setDim(_SRV_CNT.WIDTH_SUFFIX, cfg.width, 'frame-width');
      _vars.frameWidth = cfg.width;

      this._height = cfg.height = setDim(_SRV_CNT.HEIGHT_SUFFIX, cfg.height, 'frame-height');
      _vars.frameHeight = cfg.height;

      // setting clip-path is used because of slide transitions that display outside
      // the story boundaries
      this.storyAdapter.setProp('clip-path',
        `polygon(0 0, 0 ${cfg.height}px, ${cfg.width}px ${cfg.height}px, ${cfg.width}px 0px)`, args);

      args.story = this;
      this.fps = cfg.fps;
      this._isTeleporting = createParams.toTeleport || false;

      if (urlParams) {

        urlParams.replace(new RegExp(_SRV_CNT.LOG_LEVEL_SUFFIX + '(\\d+)'), (m, p1) => {
          this.logLevel = parseInt(p1); // don't use _logLevel
          return '';
        });

        urlParams.replace(new RegExp(_SRV_CNT.TELEPORT_SUFFIX + '(\\w+)'), (m, p1) => {
          this._isTeleporting = p1 === 'true';
          return '';
        });

        urlParams.replace(new RegExp(_SRV_CNT.SERVER_SUFFIX + '(\\w+)'), (m, p1) => {
          this.hasServer = true;
          this.storyAdapter.setProp('class', 'has-server', args);
          this.serverName = p1;
          this.serverFeatures = _setServer(this.serverName);
          return '';
        });

        urlParams.replace(new RegExp(_SRV_CNT.RENDER_VAR_SUFFIX + '([^&]+)', 'g'), (m, p1) => {
          p1 = decodeURIComponent(p1);
          // tslint:disable-next-line:prefer-const
          let [, key, value] = p1.match(/^([^=]+)=(.*)$/) || ['', '', ''];
          if (!key) {
            throw `render-var ${p1} requires the key field`;
          }
          key = key.replace(/-(\w)/g, (all, p: string) => p.toUpperCase());
          args.renderVars[key] = value;
          return '';
        });
      }

      args.hasServer = this.hasServer;
      args.isTeleporting = this._isTeleporting;
      args.vars.isTeleporting = args.isTeleporting;
      this._teleporter = new _Teleporter(this, cfg, this._isTeleporting);

      // #debug-start
      if (this._isVerbose) {

        this.logFrmt('story', [
          ['fps', this.fps],
          ['urlParams', urlParams],
          ['hasServer', this.hasServer.toString()],
          ['hasStory', this._teleporter.hasStory.toString()],
          ['toTeleport', this._isTeleporting.toString()],
        ]);
      }
      // #debug-end

      if (this._teleporter.hasStory) {
        this._teleporter._rebuildStory();
      } else {
        if (!createParams.dontAddDefaultScenes) { this.addDefaultScenes(); }
      }
    }

    // ------------------------------------------------------------------------
    //                               Addition
    // ------------------------------------------------------------------------

    /**
     * Adds scenes defined in the html by `.abeamer-scene` class.
     * These classes are added automatically during Story constructor.
     * Add only after a `story.reset()`.
     */
    addDefaultScenes(): void {
      const story = this;
      $('.abeamer-scene').each((index, htmlElement) => {
        story.addScene($(htmlElement));
      });
      if (this._scenes.length) { this.gotoScene(this._scenes[0]); }
    }


    /**
     * Adds a scene to the story.
     * HTML elements with abeamer-scene class are added automatically.
     *
     * @param sceneSelector DOM selector, JQuery object or Virtual Scene
     * @returns A pointer to newly created scene
     */
    addScene(sceneSelector: SceneSelector): Scene {
      const scene = new _Scene(this as _StoryImpl, sceneSelector,
        this._scenes.length ? this._scenes[this._scenes.length - 1] : undefined);
      this._scenes.push(scene);
      this._setFrameCountChanged();
      if (this._teleporter.active) { this._teleporter._addScene(); }
      return scene;
    }


    /**
     * Removes a frame from scene list and removes the its rendering pipeline
     * but its DOM elements aren't removed.
     */
    removeScene(scene: Scene): void {
      this._exceptIfRendering();
      if (this._curScene === scene) {
        (scene as _SceneImpl)._hide();
        this._curScene = undefined;
      }
      (scene as _SceneImpl)._remove();
      this._scenes.splice(scene.storySceneIndex, 1);
    }


    /**
     * Rewinds the animation to the start.
     * Deletes all the scenes and frames from the story.
     * The DOM is left untouched.
     */
    clear(): void {
      this._exceptIfRendering();
      this.rewind();
      this._internalGotoScene(undefined);
      this.scenes.length = 0;
      this._renderFramePos = 0;
      this._frameCount = 0;
    }

    // ------------------------------------------------------------------------
    //                               Animations
    // ------------------------------------------------------------------------

    /**
     * Adds a list scene/serial/parallel animations.
     * In essence, it represents the complete storyline.
     * Use this method to load the whole storyline from an external file.
     * Otherwise is preferable to add animation scene by scene.
     */
    addStoryAnimations(sceneSerialAnimes: Animations[][]): void {
      sceneSerialAnimes.forEach((sceneSerialAnime, index) => {
        this._scenes[index].addSerialAnimations(sceneSerialAnime);
      });
    }


    /**
     * Adds a list of serial/parallel animations per scene Id.
     * It requires that each scene has defined the id (DOM attribute).
     * It bypasses invalid scene ids.
     */
    addStoryAnimationsBySceneId(sceneSerialAnimes:
      { [sceneId: string]: Animation[][] }): void {

      const ids: { [id: string]: _SceneImpl } = {};

      this._scenes.forEach(scene => { ids[scene.id] = scene; });

      Object.keys(sceneSerialAnimes).forEach(id => {
        const scene = ids[id];
        if (scene) { scene.addSerialAnimations(sceneSerialAnimes[id]); }
      });
    }

    // ------------------------------------------------------------------------
    //                               Flyovers
    // ------------------------------------------------------------------------

    /**
     * Adds a flyover, which is a function executed on every render step.
     *
     * @see flyovers
     */
    addFlyover(handler: FlyoverHandler, params?: FlyoverParams): void {

      const wkFlyover = _buildWorkFlyover(handler, params, false, this._args);

      if (this._isTeleporting && this._args.stage !== AS_ADD_ANIMATION
        && this._scenes.length) {
        const scene = this._scenes[0];
        scene.addAnimations([{
          tasks: [
            {
              handler: 'add-flyover',
              params: {
                handler: wkFlyover.name,
                params: wkFlyover.params,
              } as AddFlyoverTaskParams,
            },
          ],
        }]);
      } else {
        wkFlyover.func(wkFlyover, wkFlyover.params, TS_INIT, this._args);
        this._wkFlyovers.push(wkFlyover);
      }
    }

    // ------------------------------------------------------------------------
    //                               Scene Methods
    // ------------------------------------------------------------------------

    /**
     * Changes the active and visible to a different scene.
     */
    gotoScene(scene: Scene): void {
      if (scene === this._curScene) { return; }
      this._exceptIfRendering();
      this._calcFrameCount();
      this._internalGotoScene(scene as _SceneImpl);
    }


    /**
     * Internal and faster version of gotoScene.
     */
    _internalGotoScene(scene: _SceneImpl | undefined): void {
      const curScene = this._curScene;
      if (curScene) { curScene._hide(); }
      this._curScene = scene;
      if (scene) { scene._show(); }
      this._args.scene = scene;
    }


    /** Returns the Scene Object which has `sceneName`, undefined otherwise */
    findSceneByName(sceneName: string): Scene {
      return this._scenes.find(scene => scene.name === sceneName);
    }

    // ------------------------------------------------------------------------
    //                               Frame Methods
    // ------------------------------------------------------------------------

    /**
     * Signals that there was a change in the number of frames.
     * Usually used by `addAnimations`.
     */
    _setFrameCountChanged(): void {
      this._frameCountChanged = true;
    }


    /**
     * Recomputes the total number of frames as well as other scene parameters
     * associated with frames.
     */
    _calcFrameCount(): void {
      if (!this._frameCountChanged) { return; }
      let frameCount = 0;
      this._scenes.forEach((scene, index) => {
        frameCount += scene._setStoryParams(frameCount, index);
      });
      this._frameCountChanged = false;
      this._frameCount = frameCount;
    }


    /**
     * Rewinds the animation to the start.
     */
    rewind(): void {
      this.gotoFrame(0);
    }


    /**
     * Moves the current render Position when is not rendering by consuming the pipeline.
     * Use this only if you need to compute parameters at certain position.
     * When render starts
     */
    gotoFrame(framePos: int): void {
      this._exceptIfRendering();
      this._calcFrameCount();
      if (framePos < 0 || framePos >= this._frameCount) {
        throwI8n(Msgs.OutOfScope, { p: Msgs.pos });
      }

      this._internalGotoFrame(framePos);
    }


    protected _internalGotoFrame(framePos: int): void {
      let _curScene = this._curScene;

      if (!_curScene
        || !_curScene._internalContainsFrame(framePos)) {
        _curScene = this._scenes.find(scene =>
          scene._internalContainsFrame(framePos));
        this._internalGotoScene(_curScene);
      }
      _curScene._internalGotoFrame(framePos - _curScene.storyFrameStart);
    }

    // ------------------------------------------------------------------------
    //                               Transitions
    // ------------------------------------------------------------------------

    protected _setupTransitions(): void {
      this._scenes.forEach((scene, index) => {
        scene._setupTransition();
      });
    }

    // ------------------------------------------------------------------------
    //                               Teleporting
    // ------------------------------------------------------------------------

    /**
     * Returns the animations, html, CSS as an object.
     * Use only if `isTeleporting = true`.
     * Send this information via Ajax to the remote server.
     * Due CORS, it requires a live server to access CSS information.
     * Set frameOpts, if you need segment rendering.
     * Set isPretty = true, to test only, since this mode will return a formatted output but bigger in size.
     */
    getStoryToTeleport(frameOpts?: RenderFrameOptions,
      isPretty?: boolean): string {

      if (!this._isTeleporting) {
        throw `getStoryToTeleport requires to be in teleporting mode`;
      }

      if (!this._calcRenderFrameOptions(frameOpts)) {
        return '';
      }

      return this._teleporter._getStoryToTeleport(isPretty);
    }


    /**
     * Stores the complete story on a file in the disk.
     * Use this method only for testing.
     * This method requires that:
     *
     * 1. Is on teleporting mode `isTeleporting === true`
     * 2. The render server agent. `abeamer render ...`
     *
     * Use this method instead of `getStoryToTeleport`.
     */
    teleport(frameOpts?: RenderFrameOptions, isPretty?: boolean) {

      if (!this.hasServer) {
        console.warn(`To teleport it requires the render server agent to be running`);
      }
      this._sendCmd(_SRV_CNT.MSG_TELEPORT, this.getStoryToTeleport(frameOpts, isPretty));
    }

    // ------------------------------------------------------------------------
    //                               Render
    // ------------------------------------------------------------------------

    /**
     * Throws exception if is rendering.
     */
    _exceptIfRendering(): void {
      if (this._isRendering) { throw "Render is still running"; }
    }


    /**
     * Returns the play speed that best matches the fps.
     */
    bestPlaySpeed: () => uint = () => Math.abs(1000 / this.fps);


    protected _getSceneByHandler(scene: SceneHandler): _SceneImpl {
      switch (typeof scene) {
        case 'object': return scene as _SceneImpl;

        case 'string':
          const outScene = this.findSceneByName(scene as string);
          throwIfI8n(!outScene, Msgs.Unknown, { p: scene as string });
          return outScene as _SceneImpl;

        case 'number':
          const sceneIdx = scene as number;
          if (this._strictMode) {
            throwIfI8n(isNotNegativeNatural(sceneIdx),
              Msgs.MustNatNotNegative, { p: sceneIdx });
          }
          if (sceneIdx < 0 || sceneIdx >= this._scenes.length) {
            throwI8n(Msgs.OutOfScope, { p: Msgs.pos });
          }
          return this._scenes[sceneIdx];
      }
    }


    /**
     * Computes the render properties from the user frame params.
     */
    protected _calcRenderFrameOptions(frameOpts: RenderFrameOptions): boolean {

      frameOpts = frameOpts || {};

      this._calcFrameCount();

      let renderFramePos = parseTimeHandler(frameOpts.renderPos, this._args, 0, 0);
      let renderFrameCount = parseTimeHandler(frameOpts.renderCount,
        this._args, this._frameCount, this._frameCount);

      if (frameOpts.startScene !== undefined) {
        const startScene = this._getSceneByHandler(frameOpts.startScene);
        renderFramePos += startScene.storyFrameStart;
        if (frameOpts.renderCount === undefined) {
          renderFrameCount -= startScene.storyFrameStart;
        }
      }

      if (frameOpts.endScene !== undefined) {
        const endScene = this._getSceneByHandler(frameOpts.endScene);
        if (frameOpts.renderCount === undefined) {
          renderFrameCount = endScene.storyFrameStart
            + endScene.frameCount - renderFramePos;
        }
      }

      // needs at least one frame to render
      if (!renderFrameCount) { return false; }

      const renderFrameDir: -1 | 1 = renderFrameCount > 0 ? 1 : -1;

      if (renderFrameDir === -1) {
        throwErr('Reverse render isn\'t supported yet');
      }

      const renderFrameEnd = renderFrameCount > 0
        ? renderFramePos + renderFrameCount - 1
        : renderFramePos + renderFrameCount;

      renderFrameCount = Math.abs(renderFrameCount);

      if (renderFramePos < 0 || renderFramePos >= this._frameCount) {
        throw "Render Pos is out of scope";
      }

      if (renderFrameEnd < -1 || renderFrameEnd > this._frameCount) {
        throw "Render Count is out of scope";
      }

      this._renderFramePos = renderFramePos;
      this._renderDir = renderFrameDir;
      this._renderFrameEnd = renderFrameEnd;
      this._renderFrameCount = renderFrameCount;
      return true;
    }


    /**
     * Starts the Rendering process.
     * It can render the whole storyline or just a segment.
     * Forward and backward rending is supported.
     * If it has a server, such as headless webpage capture program, it will
     * render a frame, and send a message to the server to store it on the disk.
     * If it's running on the browser, it will render and wait `playSpeedMs` time.
     *
     * @param playSpeedMs Play speed in milliseconds,
     * ignored on server mode. ABeamer doesn't guarantee the exact timing.
     * If it's undefined, it will play at full speed.
     */
    render(playSpeedMs?: uint | undefined, frameOpts?: RenderFrameOptions): void {

      if (this.hasServer && this._isTeleporting) {
        this.teleport(frameOpts, true);
        this.exit();
        return;
      }

      if (this._isRendering) {
        frameOpts = frameOpts || {};
        (frameOpts as _RenderFrameOptionsEx).playSpeedMs = playSpeedMs;
        this._queueRenders.push(frameOpts);
        return;
      }

      if (!this.hasServer) {
        // @TODO: Determine why the first frame still shows the last frame.
        // hide the story in case it takes time to build the first frame.
        this._renderHiddenStory = true;
        this.storyAdapter.setProp('visible', false, this._args);
      }

      this._internalRender(playSpeedMs, frameOpts);
    }


    protected _internalRender(playSpeedMs?: uint | undefined,
      frameOpts?: RenderFrameOptions): void {

      this._args.stage = AS_RENDERING;
      this._isRendering = true;

      if (!this._calcRenderFrameOptions(this._teleporter._fillFrameOpts(frameOpts))) {
        this.finishRender();
        return;
      }

      this._renderStage = 0;
      this._waitMan.funcs = [];
      this._waitMan.pos = 0;
      this._renderPlaySpeed = !this.hasServer && playSpeedMs !== undefined
        && playSpeedMs > 0 ? playSpeedMs : 0;
      this._setupTransitions();

      if (!this.hasServer) {
        this._renderLoop();
      } else {
        this._sendCmd(_SRV_CNT.MSG_READY);
      }
    }


    /**
     * Aborts the rendering process.
     */
    finishRender(): void {
      if (this._renderHiddenStory) {
        this._renderHiddenStory = false;
        this.storyAdapter.setProp('visible', true, this._args);
      }

      if (this._isRendering) {
        this._isRendering = false;
        if (this._renderTimer) {
          window.clearTimeout(this._renderTimer);
          this._renderTimer = undefined;
        }

        if (this._queueRenders.length) {
          const queuedRender = this._queueRenders[0];
          this._queueRenders.splice(0, 1);
          this._internalRender(queuedRender.playSpeedMs, queuedRender);
          return;
        }

        this._args.stage = AS_UNKNOWN;
        this._sendCmd(_SRV_CNT.MSG_RENDER_FINISHED);
        if (this.toExitOnRenderFinished) {
          this.exit();
        }
      }
    }


    /**
     * Renders each frame at a pre-defined speed.
     */
    protected _renderLoop() {

      let stage = this._renderStage;
      const waitMan = this._waitMan;
      while (true) {
        if (!this._isRendering) { return; }

        if (stage && waitMan.funcs.length > waitMan.pos) {
          this._renderStage = stage;
          const func = waitMan.funcs[waitMan.pos];
          waitMan.pos++;
          if (waitMan.funcs.length === waitMan.pos) {
            waitMan.pos = 0;
            waitMan.funcs = [];
          }
          func.func(this._args, func.params, () => {
            this._renderLoop();
          });
          return;
        }

        switch (stage) {
          case 0: // timestamp
            stage++;
            this._renderTimeStamp = new Date() as any;
            break;

          case 1:
            stage += 2;
            this._internalGotoFrame(this._renderFramePos);
            break;

          case 3:
            stage++;
            this._wkFlyovers.forEach(wkFlyover => {
              wkFlyover.func(wkFlyover, wkFlyover.params, TS_ANIME_LOOP,
                this._args);
            });
            break;

          case 4:
            stage++;
            if (this.onBeforeRenderFrame) { this.onBeforeRenderFrame(this._args); }
            break;

          case 5:
            stage++;
            this._curScene._internalRenderFrame(this._renderFramePos - this._curScene.storyFrameStart,
              this._renderDir, this._isVerbose, false);
            if (this._renderHiddenStory) {
              this._renderHiddenStory = false;
              this.storyAdapter.setProp('visible', true, this._args);
            }
            break;

          case 6:
            if (this.hasServer) {
              stage++;
            } else {
              stage += 2;
              // if hasServer=true, it's better to call before wait for next frame.
              if (this.onAfterRenderFrame) { this.onAfterRenderFrame(this._args); }
            }

            this._renderStage = stage;
            const newDate = new Date();
            const elapsed = newDate as any - (this._renderTimeStamp as any);
            const waitTime = Math.max(this._renderPlaySpeed - Math.floor(elapsed /* / 1000 */), 1);
            this._renderTimer = window.setTimeout(() => {
              if (!this.hasServer) {
                this._renderLoop();
              } else {
                this._sendCmd(_SRV_CNT.MSG_RENDER);
              }
            }, waitTime);
            return;

          case 7:
            // this is only called if hasServer
            stage++;
            if (this.onAfterRenderFrame) { this.onAfterRenderFrame(this._args); }
            break;

          case 8:
            stage = 0;
            if (this._renderFramePos !== this._renderFrameEnd) {
              this._renderFramePos += this._renderDir;
              if (this.onNextFrame) { this.onNextFrame(this._args); }
            } else {
              this._renderStage = -1;
              this.finishRender();
              return;
            }
            break;
        }
      }
    }

    // ------------------------------------------------------------------------
    //                               Communicate with the server
    // ------------------------------------------------------------------------

    protected _sendCmd(cmd: string, value?: string): void {
      console.log(_SRV_CNT.MESSAGE_PREFIX + cmd +
        (value ? _SRV_CNT.CMD_VALUE_SEP + value : ''));
    }


    /**
     * Terminates the server in case is a headless webpage capture program.
     * In other cases, it has no effect.
     */
    exit(): void {
      this._sendCmd(_SRV_CNT.MSG_EXIT);
    }


    /**
     * Formats a log using a format supported by exact test framework.
     * This is mostly used internally for testing, but it's publicly available.
     *
     * @param params list of [name, value]
     */
    logFrmt(tag: string, params: (string | number)[][], logType?: LogType): void {
      const msg = `${tag}:` + params.map(param => `${param[0]}=_[${param[1]}]_`)
        .join(' ');
      switch (logType) {
        case LT_WARN: this.logWarn(msg); break;
        case LT_ERROR: this.logError(msg); break;
        default:
          this.logMsg(msg);
      }
    }


    /**
     * If a server is present and supports logging,
     * it sends a log message to server otherwise it sends to the browser console.
     */
    logMsg(msg: string): void {
      if (this.hasServer && this.serverFeatures.hasLogging) {
        this._sendCmd(_SRV_CNT.MSG_LOG_MSG, msg);
      } else {
        console.log(msg);
      }
    }


    /**
     * If a server is present and supports logging,
     * it sends a warn message to server otherwise it sends to the browser console.
     */
    logWarn(msg: string): void {
      if (this.hasServer && this.serverFeatures.hasLogging) {
        this._sendCmd(_SRV_CNT.MSG_LOG_WARN, msg);
      } else {
        console.warn(msg);
      }
    }


    /**
     * If a server is present and supports logging,
     * it sends a error message to server otherwise it sends to the browser console.
     */
    logError(msg: string): void {
      if (this.hasServer && this.serverFeatures.hasLogging) {
        this._sendCmd(_SRV_CNT.MSG_LOG_ERROR, msg);
      } else {
        console.error(msg);
      }
    }


    /**
     * This method is called by the server to communicate with the client.
     */
    _internalGetServerMsg(cmd: string, value: string) {
      switch (cmd) {
        case _SRV_CNT.MSG_SERVER_READY:
          this._isServerReady = true;
          this.logMsg('Received Server Ready');
          this._sendCmd(_SRV_CNT.MSG_SET_FPS, this.fps.toString());
          this._sendCmd(_SRV_CNT.MSG_SET_FRAME_COUNT, this._frameCount.toString());
          if (this.onServerReady) { this.onServerReady(this._args); }
          this._renderLoop();
          break;

        case _SRV_CNT.MSG_RENDER_DONE:
          this._renderLoop();
          break;
      }
    }

    // ------------------------------------------------------------------------
    //                               Proxies
    // ------------------------------------------------------------------------

    getElementAdapters(selector: ElSelectorHandler): ElementAdapter[] {
      return _parseInElSelector(this, [], this.storyAdapter, selector);
    }
  }

  // ------------------------------------------------------------------------
  //                               Global Functions
  // ------------------------------------------------------------------------

  /**
   * Creates a story. Loading parameters from style data.
   * `fps` property can also be defined on `body.data-fps` or config file.
   *
   * @see config-file
   */
  export function createStory(fps?: uint,
    createParams?: CreateStoryParams): Story {

    _abeamer = new _Story({ fps }, createParams || {});
    return _abeamer;
  }


  /**
   * Creates a story by loading the configuration from a file or a teleported story.
   *
   * @see config-file
   */
  export function createStoryFromConfig(
    cfgUrl: string,
    callback: (story: Story) => void,
    fps?: uint,
    createParams?: CreateStoryParams): void {

    $.get(cfgUrl, (data: any): void => {

      let cfgRoot: { [key: string]: any };

      if (cfgUrl.endsWith('.json')) {
        cfgRoot = data;
      } else {
        cfgRoot = {};
        // @HINT: this code is a copy of  server.ts / parseIniCfgContent
        // @TODO: find a way to avoid duplicating this code
        (data as string).split(/\n/).forEach(line =>
          line.replace(/^\s*[\$@]abeamer-([\w+\-]+)\s*:\s*"?([^\n]+)"?\s*;\s*$/,
            (m, p1, p2) => {
              cfgRoot[p1] = p2;
              return '';
            }));
        cfgRoot = { config: { abeamer: cfgRoot } };
      }

      const cfgConfig = cfgRoot['config'];
      if (cfgConfig) {
        const cfg: _Config = cfgConfig['abeamer'];
        if (cfg) {
          cfg.fps = cfg.fps || fps;
          _abeamer = new _Story(cfg, createParams || {});

          callback(_abeamer);
        }
      }
    });
  }
}

let _abeamer: ABeamer._Story;
