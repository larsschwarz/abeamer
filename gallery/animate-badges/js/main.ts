"use strict";
// uuid: 4b46e734-07ff-4ae2-b3a0-4ee59d140f15

// ------------------------------------------------------------------------
// Copyright (c) 2018 Alexandre Bento Freire. All rights reserved.
// Licensed under the MIT License+uuid License. See License.txt for details
// ------------------------------------------------------------------------

$(window).on("load", () => {

  const story = ABeamer.createStory(/*FPS:*/20);

  // ------------------------------------------------------------------------
  //                               Scene
  // ------------------------------------------------------------------------

  /**
   * For command line rendering use '-' notation.
   * e.g.:
   * abeamer render --var name-background-color=blue
   */

  const scene1 = story.scenes[0];

  scene1
    .addAnimations([{
      selector: '#label',
      tasks: [{
        handler: 'add-vars',
        params: {
          overwrite: false,
          vars: {
            name: 'target',
            value: 'developer',
            duration: '2s',
            wait: '0.5s',
            nameBackgroundColor: '#5a5a5a',
            valueBackgroundColor: '#49c31b',
            easing: 'easeOutElastic',
            nameWidth: 55,
          },
        } as ABeamer.AddVarsTaskParams,
      }],
    }]);

  const args = story.args;
  const nameText = args.vars['name'] as string;
  const valueText = args.vars['value'] as string;
  const duration = args.vars['duration'] as string;
  const waitTime = args.vars['wait'] as string;
  const nameBackgroundColor = args.vars['nameBackgroundColor'] as string;
  const valueBackgroundColor = args.vars['valueBackgroundColor'] as string;
  const easing = args.vars['easing'] as string;
  const nameWidth = parseInt(args.vars['nameWidth'] as string);
  const valueWidth = story.width - nameWidth;

  scene1
    .addAnimations([{
      selector: '#label',
      props: [{
        prop: 'background-color',
        valueText: '=nameBackgroundColor',
      }, {
        prop: 'width',
        value: nameWidth,
      }, {
        prop: 'text',
        valueText: [nameText],
      }],
    }, {
      selector: '#text',
      props: [{
        prop: 'background-color',
        valueText: [valueBackgroundColor],
      }, {
        prop: 'width',
        value: valueWidth,
      }],
    }, {
      selector: '#text-value',
      duration,
      props: [{
        prop: 'text',
        duration: 1,
        valueText: [valueText],
      }, {
        prop: 'top',
        easing,
      }],
    }])
    .addStills(waitTime);

  story.render(story.bestPlaySpeed());
});
