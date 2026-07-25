// Pins the Dart port of `formatDrink` against the web behaviour in
// `src/lib/order-summary.ts`.
//
// These are not style tests. The output string is printed on a cup, so a
// divergence means the same order prints differently depending on whether the
// label came from the app or from /labels.

import 'package:ctc_printer/drink_format.dart';
import 'package:flutter_test/flutter_test.dart';

class _Order implements DrinkSummaryOrder {
  const _Order({
    this.status = 'confirmed',
    this.drinkType = '',
    this.size = '',
    this.temperature = '',
    this.milkType = '',
    this.sweetener = '',
    this.caffeine = '',
    this.specialNotes = '',
  });

  @override
  final String status;
  @override
  final String drinkType;
  @override
  final String size;
  @override
  final String temperature;
  @override
  final String milkType;
  @override
  final String sweetener;
  @override
  final String caffeine;
  @override
  final String specialNotes;
}

void main() {
  group('formatDrink', () {
    test('joins the parts in web order', () {
      expect(
        formatDrink(const _Order(
          drinkType: 'Latte',
          size: 'large',
          temperature: 'iced',
          milkType: 'Oat',
        )),
        'Large, Iced, Latte, Oat milk',
      );
    });

    test('titlecases known size and temperature values', () {
      expect(
        formatDrink(const _Order(drinkType: 'Coffee', size: 'medium')),
        'Medium, Coffee',
      );
    });

    test('passes through unknown size values unchanged', () {
      expect(
        formatDrink(const _Order(drinkType: 'Coffee', size: 'Venti')),
        'Venti, Coffee',
      );
    });

    test('appends "milk" only when the value lacks it', () {
      expect(formatDrink(const _Order(drinkType: 'Latte', milkType: 'Oat')),
          'Latte, Oat milk');
      expect(
        formatDrink(const _Order(drinkType: 'Latte', milkType: 'Whole milk')),
        'Latte, Whole milk',
      );
    });

    test('does not repeat a modifier the drink already states', () {
      // "Iced latte" must not become "Iced, Iced latte".
      expect(
        formatDrink(const _Order(drinkType: 'Iced latte', temperature: 'iced')),
        'Iced latte',
      );
      expect(
        formatDrink(const _Order(drinkType: 'Oat latte', milkType: 'Oat')),
        'Oat latte',
      );
    });

    test('drops a drink that only restates the size', () {
      expect(
        formatDrink(const _Order(drinkType: 'Large', size: 'large')),
        'Large',
      );
    });

    test('promotes notes that look like a drink when none was entered', () {
      expect(
        formatDrink(const _Order(specialNotes: 'Cold brew, extra ice')),
        'Cold brew, extra ice',
      );
    });

    test('keeps notes separate when a drink was entered', () {
      expect(
        formatDrink(const _Order(drinkType: 'Latte', specialNotes: 'No lid')),
        'Latte, No lid',
      );
    });

    test('shows caffeine only when it is not the Regular default', () {
      expect(
        formatDrink(const _Order(drinkType: 'Latte', caffeine: 'Regular')),
        'Latte',
      );
      expect(
        formatDrink(const _Order(drinkType: 'Latte', caffeine: 'Decaf')),
        'Latte, Decaf',
      );
    });

    test('collapses whitespace', () {
      expect(
        formatDrink(const _Order(drinkType: '  Flat   white  ')),
        'Flat white',
      );
    });

    test('includes sweetener after the milk', () {
      expect(
        formatDrink(const _Order(
          drinkType: 'Latte',
          milkType: 'Oat',
          sweetener: 'Two sugars',
        )),
        'Latte, Oat milk, Two sugars',
      );
    });

    test('reports a declined order', () {
      expect(formatDrink(const _Order(status: 'no_order')), 'No order');
      expect(formatDrink(null), 'No order');
    });

    test('reports an empty captured order', () {
      expect(formatDrink(const _Order()), 'Order not entered');
    });
  });

  group('capture state', () {
    test('treats legacy pipeline statuses as captured', () {
      for (final status in ['confirmed', 'ordered', 'picked_up', 'delivered']) {
        expect(isOrderCaptured(status), isTrue, reason: status);
      }
    });

    test('waiting and declined orders are not captured', () {
      expect(isOrderCaptured('not_asked'), isFalse);
      expect(isOrderCaptured('no_order'), isFalse);
      expect(isOrderCaptured(null), isFalse);
    });

    test('skip and needs-order are distinguishable', () {
      expect(isOrderSkipped('no_order'), isTrue);
      expect(needsOrder('not_asked'), isTrue);
      expect(needsOrder(null), isTrue);
      expect(needsOrder('confirmed'), isFalse);
    });
  });
}
