"use strict";
// uuid: ce496037-5728-4543-b2b1-f8a9aaa3d0f0

// ------------------------------------------------------------------------
// Copyright (c) 2018 Alexandre Bento Freire. All rights reserved.
// Licensed under the MIT License+uuid License. See License.txt for details
// ------------------------------------------------------------------------

// Implements a list of built-in chart Tasks

/** @module end-user | The lines bellow convey information for the end-user */

/**
 * ## Description
 *
 * A **chart task** task creates an animated chart.
 *
 * **WARN** This plugin is still in alpha stage, parts of API can change in the future.
 * It's still missing labelsX and legends and many internal parts.
 * It will be improved soon.
 *
 * This plugin has the following built-in charts:
 *
 * - `marker`.
 * - `bar`.
 * - `line`.
 * - `area`.
 * - `mixed`- Draws different types of chars in the same chart, uses
 *   `chartTypes` parameter to determine the type of each chart per series.
 *
 * read the details on `AxisChartTaskParams`.
 */
namespace ABeamer {

  // #generate-group-section
  // ------------------------------------------------------------------------
  //                               Shape Tasks
  // ------------------------------------------------------------------------

  // The following section contains data for the end-user
  // generated by `gulp build-definition-files`
  // -------------------------------
  // #export-section-start: release

  export enum ChartTypes {
    bar,
    area,
    line,
    marker,
    mixed,
  }

  export type ChartTaskName = 'chart';

  export type SeriesData = number[];


  export interface BaseChartTaskParams extends AnyParams {
    chartType?: ChartTypes | string;
    data: SeriesData[];
    animeSelector?: string;
  }


  export enum ChartCaptionOrientation {
    horizontal,
    vertical,
  }

  export enum ChartCaptionPosition {
    top,
    bottom,
    left,
    right,
  }

  export interface ChartCaptions {
    fontColor?: string | ExprString;
    fontFamily?: string | ExprString;
    fontSize?: uint | ExprString;
    marginTop?: uint | ExprString;
    marginBottom?: uint | ExprString;
  }


  export interface ChartLabels extends ChartCaptions {
    labels?: string[];
  }


  export type ChartLabelsX = ChartLabels;

  export type ChartLabelsY = ChartLabels;


  export enum ChartPointShape {
    circle,
    square,
    diamond,
  }


  export interface ChartMarkers {
    visible?: boolean | boolean[] | boolean[][];
    shape?: (ChartPointShape | string) | (ChartPointShape | string)[]
    | (ChartPointShape | string)[][];
    size?: uint | uint[] | uint[][];
    color?: string | string[] | string[][];
  }


  export interface ChartLine {
    visible?: boolean;
    color?: string | ExprString;
    width?: number | ExprString;
  }


  export interface ChartTitle extends ChartCaptions {
    caption: string | ExprString;
  }


  export interface AxisChartTaskParams extends BaseChartTaskParams {

    /** Chart Type per series. Use only if charType is `mixed`. */
    charTypes?: (ChartTypes | string)[];

    // title
    title?: string | ExprString | ChartTitle;

    // labels X
    labelsX?: ChartLabelsX;

    // labels Y
    labelsY?: ChartLabelsY;

    // markers
    markers?: ChartMarkers;

    // columns
    colWidth?: uint | ExprString;
    colMaxHeight?: uint | ExprString;
    colSpacing?: uint | ExprString;
    colInterSpacing?: uint | ExprString;

    // colors
    fillColors?: string[] | string;
    negativeFillColors?: string[] | string;
    strokeColors?: string[] | string;
    stokeWidth?: uint[] | uint;
    xAxis?: ChartLine;
    yAxis?: ChartLine;
    y0Line?: ChartLine;

    // limits
    maxValue?: number | ExprString;
    minValue?: number | ExprString;

    // animation
    colHeightStart?: number | ExprString;
    deviationStart?: number | ExprString;
    sweepStart?: number | ExprString;
  }

  // #export-section-end: release
  // -------------------------------

  // ------------------------------------------------------------------------
  //                               Implementation
  // ------------------------------------------------------------------------

  pluginManager.addPlugin({
    id: 'abeamer.chart-tasks',
    uuid: '73631f28-df71-4b4d-88e1-c99a858e0fd3',
    author: 'Alexandre Bento Freire',
    email: 'abeamer@a-bentofreire.com',
    jsUrls: ['plugins/chart-tasks/chart-tasks.js'],
    teleportable: true,
  });


  function _parseSeriesList<T>(numSeries: int, list: T[] | T,
    defaultValue: T, args: ABeamerArgs): T[] {

    const res = [];
    for (let i = 0; i < numSeries; i++) {

      if (list) {
        if (Array.isArray(list)) {
          if (i < list.length) {
            res.push(list[i]);
          } else {
            res.push(defaultValue);
          }
        } else {
          res.push(list);
        }
      } else {
        res.push(defaultValue);
      }
    }
    return res;
  }

  // ------------------------------------------------------------------------
  //                               _WkChart
  // ------------------------------------------------------------------------

  abstract class _WkChart {

    protected canvas: HTMLCanvasElement;
    protected context: CanvasRenderingContext2D;
    protected chartWidth: uint;
    protected chartHeight: uint;

    protected chartType: ChartTypes;
    protected min: number;
    protected max: number;
    protected avg: number;
    protected seriesLen: uint;
    protected data: SeriesData[];

    protected animator: _ChartVirtualAnimator;


    constructor(protected args: ABeamerArgs) { }

    abstract _initChart(params: BaseChartTaskParams): void;

    abstract _drawChart(params: BaseChartTaskParams): void;


    _init(elAdapter: ElementAdapter, chartType: ChartTypes,
      animator: _ChartVirtualAnimator | undefined): void {

      this.canvas = elAdapter.getProp('element', this.args) as any;
      if (!this.canvas) {
        throwErr(`Didn't find the ${elAdapter.getId()}`);
      }

      this.context = this.canvas.getContext('2d');
      this.chartWidth = this.canvas.width;
      this.chartHeight = this.canvas.height;
      this.chartType = chartType;
      this.animator = animator;
    }


    _initData(data: SeriesData[]): void {
      let max = -Number.MIN_VALUE;
      let min = Number.MAX_VALUE;
      const firstSeriesLen = data[0].length;
      data.forEach(series => {
        if (series.length !== firstSeriesLen) {
          throwErr(`Every Series must have the same length`);
        }
        series.forEach(point => {
          max = Math.max(max, point);
          min = Math.min(min, point);
        });
      });

      this.min = min;
      this.max = max;
      this.avg = (max - min) / 2;
      this.seriesLen = firstSeriesLen;
      this.data = data;
    }
  }

  // ------------------------------------------------------------------------
  //                               _ChartVirtualAnimator
  // ------------------------------------------------------------------------

  class _ChartVirtualAnimator implements VirtualAnimator {

    charts: _WkChart[] = [];
    params: BaseChartTaskParams;
    props: AnyParams = {};
    selector: string;


    getProp(name: PropName): PropValue {
      return this.props[name];
    }


    setProp(name: PropName, value: PropValue, args?: ABeamerArgs): void {
      this.props[name] = value;
      if (name !== 'uid') {
        this.charts.forEach(chart => {
          chart._drawChart(this.params);
        });
      }
    }
  }

  // ------------------------------------------------------------------------
  //                               Captions
  // ------------------------------------------------------------------------

  interface _WkChartCaptions {
    fontColor?: string;
    fontFamily?: string;
    fontSize?: uint;
    marginTop?: uint;
    marginBottom?: uint;
    orientation?: uint;
    position?: uint;
    width?: uint;
    height?: uint;
    x?: uint;
    y?: uint;
  }


  function _setUpCaptionsFont(l: _WkChartCaptions, ctx: CanvasRenderingContext2D): void {
    ctx.font = `${l.fontSize}px ${l.fontFamily}`;
    ctx.fillStyle = l.fontColor;
  }

  // ------------------------------------------------------------------------
  //                               Labels
  // ------------------------------------------------------------------------

  interface _WkChartLabels extends _WkChartCaptions {
    captions?: string[];
  }


  function _alignCaptions(l: _WkChartCaptions, ctx: CanvasRenderingContext2D,
    text: string, width: uint): uint {

    const sz = ctx.measureText(text);
    return (width - sz.width) / 2;
  }

  // ------------------------------------------------------------------------
  //                               Line
  // ------------------------------------------------------------------------

  interface _WkChartLine {
    visible: boolean;
    color: string;
    width: number;
  }

  // ------------------------------------------------------------------------
  //                               Points
  // ------------------------------------------------------------------------

  interface _WkChartTitle extends _WkChartCaptions {
    caption?: string;
  }

  // ------------------------------------------------------------------------
  //                               Points
  // ------------------------------------------------------------------------

  interface _WkChartMarkers {
    visible?: boolean[][];
    shape?: ChartPointShape[][];
    size?: uint[][];
    color?: string[][];
  }

  // ------------------------------------------------------------------------
  //                               Bar Chart
  // ------------------------------------------------------------------------

  class _WkAxisChart extends _WkChart {

    /** Chart Type per series. Use only if charType is `mixed`. */
    chartTypes: ChartTypes[];

    // axis
    xAxis: _WkChartLine;
    yAxis: _WkChartLine;
    y0Line: _WkChartLine;

    // title
    title: _WkChartTitle = {};

    // labels X
    labelsX: _WkChartLabels;

    // labels Y
    labelsY: _WkChartLabels;

    // points
    markers: _WkChartMarkers;
    hasMarkers: boolean;

    // bar chart
    barWidth: uint;
    barMaxHeight: uint;
    barSpacing: uint;
    barSeriesSpacing: uint;

    // colors
    fillColors: string[];
    negativeFillColors: string[];
    stokeColors: string[];
    stokeWidth: uint[];

    // limits
    maxValue: number;
    minValue: number;
    avgValue: number;

    // overflow
    overflow: uint = 0;

    // graph  (x0, y0) = (left, bottom)
    graphX0: uint = 0;
    graphY0: uint;
    graphX1: uint;
    graphY1: uint = 0;

    protected _initCaptions(defPosition: ChartCaptionPosition, captions: string[],
      labThis: ChartLabels, labOther: ChartLabels): _WkChartCaptions {

      const res: _WkChartCaptions = {
        fontColor: ExprOrStrToStr(labThis.fontColor || labOther.fontColor,
          'black', this.args),
        fontFamily: ExprOrStrToStr(labThis.fontFamily || labOther.fontFamily,
          'sans-serif', this.args),
        fontSize: ExprOrNumToNum(labThis.fontSize || labOther.fontSize,
          12, this.args),
        marginTop: ExprOrNumToNum(labThis.marginTop, 0, this.args),
        marginBottom: ExprOrNumToNum(labThis.marginBottom, 0, this.args),
        position: defPosition,
        orientation: ChartCaptionOrientation.horizontal,
      };

      _setUpCaptionsFont(res, this.context);
      const joinChar = res.position === ChartCaptionPosition.top ||
        res.position === ChartCaptionPosition.bottom ? ' ' : '\n';

      const joinedText = captions.join(joinChar);
      const sz = this.context.measureText(joinedText);
      res.width = sz.width;
      res.height = res.fontSize;

      let d: uint;
      switch (res.position) {
        case ChartCaptionPosition.top:
          res.y = this.graphY1 + res.height + res.marginTop;
          d = res.height + res.marginTop + res.marginBottom;
          this.graphY1 += d;
          break;

        case ChartCaptionPosition.bottom:
          res.y = this.graphY0 - res.marginBottom;
          d = res.height + res.marginTop + res.marginBottom;
          this.graphY0 -= d;
          break;
      }
      return res;
    }


    protected _initLabels(params: AxisChartTaskParams): void {
      const labelsX: ChartLabelsX = params.labelsX || {};
      const labelsY: ChartLabelsY = params.labelsY || {};
      let labels;

      // labels X
      labels = labelsX.labels;
      if (labels) {
        this.labelsX = this._initCaptions(ChartCaptionPosition.bottom,
          labels, labelsX, labelsY);
        this.labelsX.captions = labels;
      }

      // labels Y
      labels = labelsX.labels;
      if (labels) {
        this.labelsY = this._initCaptions(ChartCaptionPosition.left,
          labels, labelsY, labelsX);
        this.labelsY.captions = labels;
      }
    }


    protected _initTitle(params: AxisChartTaskParams) {
      let title = params.title || {} as ChartTitle;
      if (typeof title === 'string') {
        title = {
          caption: title as string,
        };
      }

      if (title.caption) {
        this.title = this._initCaptions(ChartCaptionPosition.top,
          [title.caption], title, title);
        this.title.caption = ExprOrStrToStr(title.caption, '', this.args);
      }
    }


    protected _initLine(line: ChartLine): _WkChartLine {

      return {
        visible: line.visible !== undefined ? line.visible : true,
        color: ExprOrStrToStr(line.color, '#7c7c7c', this.args),
        width: ExprOrNumToNum(line.width, 1, this.args),
      };
    }


    protected _fillArrayArrayParam<TI, TO>(param: TI | TI[] | TI[][],
      defValue: TI, strMapper?: any): TO[][] {

      const res: TO[][] = [];

      if (param === undefined) {
        param = defValue;
      }

      const isParamArray = Array.isArray(param);
      if (!isParamArray && strMapper && typeof param === 'string') {
        param = strMapper[param];
      }

      this.data.forEach((series, seriesI) => {
        let resItem = [];
        if (!isParamArray) {
          resItem = series.map(v => param);
        } else {

          let subParam = param[seriesI];
          const isSubParamArray = Array.isArray(subParam);
          if (!isSubParamArray && strMapper && typeof subParam === 'string') {
            subParam = strMapper[subParam];
          }

          if (!isSubParamArray) {
            resItem = series.map(v => subParam);
          } else {
            resItem = series.map((v, i) => {
              let itemParam = subParam[i];
              if (strMapper && typeof itemParam === 'string') {
                itemParam = strMapper[itemParam];
              }
              return itemParam;
            });
          }
        }
        res.push(resItem);
      });
      return res;
    }


    protected _initMarkers(params: AxisChartTaskParams): void {
      const markers: _WkChartMarkers = {};
      this.hasMarkers = params.markers !== undefined || this.chartTypes
        .findIndex(cType => cType === ChartTypes.marker) !== -1;

      const pMarkers = params.markers || {};

      if (this.hasMarkers) {
        markers.visible = this._fillArrayArrayParam<boolean, boolean>(
          pMarkers.visible, this.chartType === ChartTypes.marker);
        markers.shape = this._fillArrayArrayParam<ChartPointShape | string, ChartPointShape>(
          pMarkers.shape, ChartPointShape.square, ChartPointShape);
        markers.size = this._fillArrayArrayParam<uint, uint>(
          pMarkers.size, 5);
        markers.color = this._fillArrayArrayParam<string, string>(
          pMarkers.color, 'black');
      }
      this.markers = markers;
    }


    protected _drawMarkers(dataPixels: int[][][]): void {
      const points = this.markers;
      const ctx = this.context;

      this.data.forEach((series, seriesI) => {
        for (let i = 0; i < series.length; i++) {
          if (points.visible[seriesI][i]) {
            ctx.fillStyle = points.color[seriesI][i];
            const size = points.size[seriesI][i];
            const sizeDiv2 = size / 2;
            const [x, y] = dataPixels[seriesI][i];
            switch (points.shape[seriesI][i]) {
              case ChartPointShape.circle:
                ctx.beginPath();
                ctx.arc(x, y, sizeDiv2, 0, Math.PI * 2);
                ctx.fill();
                break;

              case ChartPointShape.diamond:
                ctx.beginPath();
                ctx.moveTo(x - sizeDiv2, y);
                ctx.lineTo(x, y - sizeDiv2);
                ctx.lineTo(x + sizeDiv2, y);
                ctx.lineTo(x, y + sizeDiv2);
                ctx.fill();
                break;

              case ChartPointShape.square:
                ctx.fillRect(x - sizeDiv2, y - sizeDiv2, sizeDiv2, sizeDiv2);
                break;
            }
          }
        }
      });
    }


    protected _drawLine(line: _WkChartLine,
      x0: uint, y0: uint, x1: uint, y1: uint): void {

      const ctx = this.context;
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.width;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }


    /** Initializes all the Axis Chart parameters. */
    _initChart(params: AxisChartTaskParams): void {

      this.chartTypes = this.data.map((series, seriesIndex) => {
        if (this.chartType !== ChartTypes.mixed) {
          return this.chartType;
        }

        if (!params.charTypes || params.charTypes.length <= seriesIndex) {
          return ChartTypes.bar;
        }

        const chartType = params.charTypes[seriesIndex];
        return typeof chartType === 'string' ? ChartTypes[chartType] : chartType;
      });

      // axis
      this.xAxis = this._initLine(params.xAxis || {});
      this.yAxis = this._initLine(params.yAxis || {});
      this.y0Line = this._initLine(params.y0Line || {});

      // bar chart
      this.barWidth = ExprOrNumToNum(params.colWidth, 20, this.args);
      this.barMaxHeight = ExprOrNumToNum(params.colMaxHeight, 100, this.args);
      this.barSpacing = ExprOrNumToNum(params.colSpacing, 5, this.args);
      this.barSeriesSpacing = ExprOrNumToNum(params.colInterSpacing, 0, this.args);

      // limits
      this.maxValue = ExprOrNumToNum(params.maxValue, this.max, this.args);
      this.minValue = ExprOrNumToNum(params.minValue, Math.min(this.min, 0), this.args);
      this.avgValue = this.avg;

      // colors
      this.fillColors = _parseSeriesList<string>(this.data.length, params.fillColors,
        'white', this.args);
      this.negativeFillColors = !params.negativeFillColors ? this.fillColors :
        _parseSeriesList<string>(this.data.length, params.negativeFillColors,
          'white', this.args);
      this.stokeColors = _parseSeriesList<string>(this.data.length, params.strokeColors,
        'black', this.args);
      this.stokeWidth = _parseSeriesList<uint>(this.data.length, params.strokeWidth,
        1, this.args);

      this.graphX1 = this.chartWidth;
      this.graphY0 = this.chartHeight;
      this._initMarkers(params);
      this._initTitle(params);
      this._initLabels(params);

      // animation
      if (this.animator) {
        this.animator.props['col-height'] = ExprOrNumToNum(params.colHeightStart, 1, this.args);
        this.animator.props['deviation'] = ExprOrNumToNum(params.deviationStart, 1, this.args);
        this.animator.props['sweep'] = ExprOrNumToNum(params.sweepStart, 1, this.args);
      }
    }


    /** Implements Axis Chart animation. */
    _drawChart(params: AxisChartTaskParams): void {

      const animator = this.animator;
      const barHeightV = animator ? animator.props['col-height'] : 1;
      const deviationV = animator ? animator.props['deviation'] : 1;
      const sweepV = animator ? animator.props['sweep'] : 1;

      const chartWidth = this.chartWidth;
      const chartHeight = this.chartHeight;
      const ctx = this.context;
      const x0 = this.graphX0;
      const y0 = this.graphY0;
      const topMargin = 1;
      const yLength = y0 - this.graphY1 - topMargin;

      // bar
      const barWidth = this.barWidth;
      const barSpacing = this.barSpacing;
      const barSeriesSpacing = this.barSeriesSpacing;

      // values
      const maxValue = this.maxValue;
      const minValue = this.minValue;
      const valueRange = maxValue - minValue;

      // y0 line
      const hasY0Line = maxValue * minValue < 0;
      const vy0Line = hasY0Line ? 0 : minValue >= 0 ? minValue : maxValue;
      const vy0LineClip = (vy0Line - minValue) / valueRange;
      const axis0Y = y0 - yLength * vy0LineClip;

      // data
      const data = this.data;
      const seriesLen = this.seriesLen;

      const maxSeriesLen = sweepV >= 1 ? seriesLen :
        Math.max(Math.min(Math.floor(seriesLen * sweepV) + 1, seriesLen), 0);

      // computes x-shift created by side-by-side bars.
      // only bar charts cause a x-shift.
      const xShiftPerSeries = [];
      let xShift = 0;

      data.forEach((series, seriesI) => {
        if (this.chartTypes[seriesI] === ChartTypes.bar) {
          if (xShift) {
            xShift += barSeriesSpacing;
          }
          xShiftPerSeries.push(xShift);
          xShift += barWidth;
        } else {
          xShiftPerSeries.push(0);
        }
      });
      if (!xShift) {
        xShift += barWidth;
      }
      const dataWidths = xShift + barSpacing;
      // the last bar doesn't needs barSpacing
      const totalWidth = dataWidths * seriesLen - barSpacing;
      const x1 = x0 + totalWidth;

      ctx.clearRect(0, 0, chartWidth, chartHeight);

      const y = axis0Y;
      const dataMidPixels: int[][][] = [];
      // data points
      data.forEach((series, seriesI) => {

        let xPrev: int;
        let yPrev: int;
        const seriesPixels: int[][] = [];
        const seriesMidPixels: int[][] = [];

        const chartType = this.chartTypes[seriesI];
        ctx.lineWidth = this.stokeWidth[seriesI];
        ctx.strokeStyle = this.stokeColors[seriesI];

        for (let i = 0; i < maxSeriesLen; i++) {

          let v = series[i];
          if (Math.abs(deviationV - 1) > 1e-6) {
            v = this.avgValue - ((this.avgValue - v) * deviationV);
          }

          ctx.fillStyle = v >= 0 ? this.fillColors[seriesI] :
            this.negativeFillColors[seriesI];

          const x = x0 + dataWidths * i + xShiftPerSeries[seriesI];
          const vClip = (v - vy0Line) / valueRange;
          const vT = vClip * barHeightV;
          const yLen = -yLength * vT;
          const xLen = dataWidths / 2;

          let xNew = xLen + x;
          let yNew = yLen + y;

          if ((i === maxSeriesLen - 1) && (sweepV < 1)) {
            const leftSweep = (sweepV - i / seriesLen);
            const reSweep = leftSweep / (1 / seriesLen);
            xNew = ((xNew - xPrev) * reSweep) + xPrev;
            yNew = ((yNew - yPrev) * reSweep) + yPrev;
          }

          let xMidNew = xNew;
          const yMidNew = yNew;

          switch (chartType) {
            case ChartTypes.bar:
              ctx.fillRect(x, y, barWidth, yLen);
              ctx.strokeRect(x, y, barWidth, yLen);
              xMidNew = x + barWidth / 2;
              break;

            case ChartTypes.line:
              if (i) {
                ctx.beginPath();
                ctx.moveTo(xPrev, yPrev);
                ctx.lineTo(xNew, yNew);
                ctx.stroke();
              }
              break;
          }

          xPrev = xNew;
          yPrev = yNew;
          seriesPixels.push([xNew, yNew]);
          seriesMidPixels.push([xMidNew, yMidNew]);
        }

        if (chartType === ChartTypes.area) {
          ctx.beginPath();
          ctx.moveTo(seriesPixels[0][0], y);
          seriesPixels.forEach(point => {
            ctx.lineTo(point[0], point[1]);
          });
          ctx.lineTo(seriesPixels[seriesPixels.length - 1][0], y);
          ctx.lineTo(seriesPixels[0][0], y);
          ctx.fill();
          ctx.stroke();
        }

        dataMidPixels.push(seriesMidPixels);
      });

      ctx.lineWidth = 1;

      // markers
      if (this.hasMarkers) {
        this._drawMarkers(dataMidPixels);
      }

      // titles
      const titleCaption = this.title.caption;
      if (this.title.caption) {
        _setUpCaptionsFont(this.title, ctx);
        const titleXPos = _alignCaptions(this.title, ctx,
          titleCaption, x1 - x0);
        ctx.fillText(titleCaption, x0 + titleXPos, this.title.y);
      }

      // labels
      if (this.labelsX) {
        _setUpCaptionsFont(this.labelsX, ctx);
        for (let i = 0; i < seriesLen; i++) {
          const x = x0 + dataWidths * i;
          const text = this.labelsX.captions[i];
          const deltaX = _alignCaptions(this.labelsX, ctx, text, xShift);
          ctx.fillText(text, x + deltaX, this.labelsX.y);
        }
      }

      // y0Line
      if (hasY0Line && this.y0Line.visible) {
        this._drawLine(this.y0Line, x0, axis0Y, x1, axis0Y);
      }

      // x-axis
      if (this.xAxis.visible) {
        this._drawLine(this.xAxis, x0, y0, x1, y0);
      }

      // y-axis
      if (this.yAxis.visible) {
        this._drawLine(this.yAxis, x0, y0, x0, y0 - yLength);
      }
    }
  }

  // ------------------------------------------------------------------------
  //                               Chart Task
  // ------------------------------------------------------------------------

  pluginManager.addTasks([['chart', _chartTask]]);


  /** Implements the Chart Task */
  function _chartTask(anime: Animation, wkTask: WorkTask,
    params: BaseChartTaskParams, stage: uint, args: ABeamerArgs): TaskResult {

    switch (stage) {
      case TS_INIT:
        let cType = params.chartType;
        if (typeof cType === 'string') {
          cType = ChartTypes[cType] as ChartTypes;
        }


        const data = params.data;
        if (!data.length) {
          throwErr(`Series have empty data`);
        }

        let animator: _ChartVirtualAnimator;

        if (params.animeSelector) {
          animator = new _ChartVirtualAnimator();
          animator.selector = params.animeSelector;
          animator.params = params;
          args.story.virtualAnimators.push(animator);
        }

        const elAdapters = args.scene.getElementAdapters(anime.selector);
        args.vars.elCount = elAdapters.length;
        elAdapters.forEach((elAdapter, elIndex) => {

          args.vars.elIndex = elIndex;

          let chart: _WkChart;

          switch (cType) {
            case ChartTypes.marker:
            case ChartTypes.bar:
            case ChartTypes.line:
            case ChartTypes.area:
            case ChartTypes.mixed:
              chart = new _WkAxisChart(args);
              break;
            default:
              throwI8n(Msgs.UnknownType, { p: params.chartType });
          }

          chart._init(elAdapter, cType as ChartTypes, animator);
          chart._initData(data);
          chart._initChart(params);
          chart._drawChart(params);

          if (animator) { animator.charts.push(chart); }
        });
        break;
    }
    return TR_EXIT;
  }
}
