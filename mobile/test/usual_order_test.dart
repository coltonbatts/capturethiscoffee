import 'package:ctc_printer/production_board.dart';
import 'package:ctc_printer/usual_order.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses the same usual-order vocabulary as the web', () {
    final patch =
        parseUsualOrderPatch('Large, Iced latte, Oat milk, Half sweet');

    expect(patch.values[OrderField.drinkType], 'Iced latte');
    expect(patch.values[OrderField.size], 'Large');
    expect(patch.values[OrderField.temperature], 'Iced');
    expect(patch.values[OrderField.milkType], 'Oat');
    expect(patch.values[OrderField.sweetener], 'Half sweet');
    expect(patch.values[OrderField.caffeine], 'Regular');
    expect(patch.values[OrderField.status], 'confirmed');
  });
}
