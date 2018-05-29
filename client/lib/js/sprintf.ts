"use strict";
// uuid: c59478ce-5f42-4538-8599-0e275fbc494f

// ------------------------------------------------------------------------
// Copyright (c) 2018 Alexandre Bento Freire. All rights reserved.
// Licensed under the MIT License+uuid License. See License.txt for details
// ------------------------------------------------------------------------

// This module will generate a node module,
// therefore it can't contain external references.

/** @module shared   | This module will generate a shared/lib file */
/** @module end-user | The lines bellow convey information for the end-user */

/**
 * ## Description
 *
 * **sprintf** is minimalist string formatter utility.
 * Supports only `%[flag][width]specifier[^round-func]`.
 *
 * Where 'flag' is:
 * - `0` - to left pad with zeros.
 *
 * Where 'width' is the total number of characters.
 *
 * Where 'specifier' is:
 * - `d` - decimal integer value. (use a round-func to remove the floating part.)
 * - `f` - represents the number as a floating point number.
 * - `x` - converts to hexadecimal number.
 * - `s` - String of characters.
 *
 * Where 'round-func' is:
 *
 * - `r` - rounds to the nearest decimal value.
 * - `d` - rounds to the nearest decimal value but for 0.5 is always rounded down.
 * - `f` - rounds to the lowermost decimal value.
 * - `c` - rounds to the uppermost decimal value.
 */
namespace ABeamer {

  // ------------------------------------------------------------------------
  //                               Round Functions
  // ------------------------------------------------------------------------

  /**
   * Performs a math round where the 0.5 is always rounded down.
   */
  export function downRound(v: number): int {
    return Math.round(v - 0.0001);
  }

  // ------------------------------------------------------------------------
  //                               Mini SPrintf
  // ------------------------------------------------------------------------

  /**
   * Minimalist string formatter.
   */
  export function sprintf(
    // pattern containing %d formatters
    format: string,
    // value to replace
    ...values): string {

    let valueIndex = 0;
    return format.replace(/%(0*)((?:[1-9])?)([dfx])(?:\^([rfcd]))?/g,
      (match, hasZeros, strNumDigits, specifier, roundFunc) => {
        let out;
        let strNumber;

        let value = values[valueIndex++];

        if (roundFunc) {
          switch (roundFunc) {
            case 'r': value = Math.round(value); break;
            case 'd': value = downRound(value); break;
            case 'c': value = Math.ceil(value); break;
            case 'f': value = Math.floor(value); break;
          }
        }

        switch (specifier) {
          case 'd': strNumber = (roundFunc ? value : Math.floor(value)).toString(); break;
          case 'f': strNumber = value.toString(); break;
          case 'x': strNumber = value.toString(16); break;
        }

        out = strNumber;
        if (strNumDigits) {
          const numDigits = parseInt(strNumDigits);
          if (numDigits > strNumber.length) {
            out = new Array(numDigits - strNumber.length + 1).join(
              hasZeros ? '0' : ' ') + out;
          }
        }
        return out;
      });
  }
}
