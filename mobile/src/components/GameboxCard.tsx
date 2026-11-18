// Figma: 450:5419 (folha aberta: QR 189 px 450:5526, nome (SemiBold 16) e número 450:5527, blocos `colors.sheetCard` raio 16
// Estádio 450:5529 e Pavilhão 450:5546 com Porta, Sector, Fila, Lugar) e 348:40189 (só Estádio, sem pavilhão).
// O QR é gerado a partir do número (react-native-qrcode-svg), não a imagem do nó.
// SEM FIGMA: número ilegível (sem QR, com explicação).
// Task 24: o número decifrado só se mostra no ecrã; nunca vai para logs.
import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { gameboxLabel, normalizeGameboxNumber, VENUE_NAMES, type GameboxView, type Seat } from '@/lib/gamebox';
import { colors, layout, type } from '@/theme/tokens';

export const CARD_TEXT = {
  stadium: 'Estádio',
  pavilion: 'Pavilhão',
  unreadable: 'Não foi possível ler o número desta GameBox. Corrige-o em Gestão de Gamebox.',
} as const;

const SEAT_COLUMNS: { key: keyof Seat; label: string }[] = [
  { key: 'port', label: 'Porta' },
  { key: 'sector', label: 'Sector' },
  { key: 'line', label: 'Fila' },
  { key: 'seat', label: 'Lugar' },
];

function Column({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={{ gap: layout.gameboxSeatLabelGap, width: wide ? layout.gameboxSeatVenueWidth : undefined, flexShrink: 1 }}>
      <Text style={type.gameboxSeatLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={type.gameboxSeatValue} numberOfLines={1}>
        {value || ' '}
      </Text>
    </View>
  );
}

function SeatBlock({ venue, venueName, seat }: { venue: string; venueName: string; seat: Seat }) {
  return (
    <View
      accessible
      accessibilityLabel={`${venue} ${venueName}: ${SEAT_COLUMNS.map((c) => `${c.label} ${seat[c.key] || '-'}`).join(', ')}`}
      style={{
        backgroundColor: colors.sheetCard,
        borderRadius: layout.gameboxSeatRadius,
        padding: layout.gameboxSeatPad,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignSelf: 'stretch',
      }}
    >
      <Column label={venue} value={venueName} wide />
      {SEAT_COLUMNS.map((c) => (
        <Column key={c.key} label={c.label} value={seat[c.key]} />
      ))}
    </View>
  );
}

export function GameboxCard({ gamebox, index = 0 }: { gamebox: GameboxView; index?: number }) {
  const number = normalizeGameboxNumber(gamebox.number);
  const name = gameboxLabel(gamebox.name, index);
  return (
    <View style={{ alignItems: 'center', gap: layout.gameboxSheetGap }}>
      <View style={{ alignItems: 'center', gap: layout.gameboxQrGap }}>
        {number ? (
          <View accessible accessibilityRole="image" accessibilityLabel={`Código QR da GameBox ${name}`}>
            <QRCode value={number} size={layout.gameboxQr} color={colors.black} backgroundColor={colors.white} quietZone={0} />
          </View>
        ) : null}
        <Text style={type.gameboxName} numberOfLines={1}>
          {name}
        </Text>
        {number ? (
          <Text style={type.gameboxNumber} selectable>
            {number}
          </Text>
        ) : (
          <Text style={type.gameboxNumber}>{CARD_TEXT.unreadable}</Text>
        )}
      </View>
      <View style={{ alignSelf: 'stretch', gap: layout.gameboxQrGap }}>
        <SeatBlock venue={CARD_TEXT.stadium} venueName={VENUE_NAMES.stadium} seat={gamebox.stadium} />
        {gamebox.pavilion ? (
          <SeatBlock venue={CARD_TEXT.pavilion} venueName={VENUE_NAMES.pavilion} seat={gamebox.pavilion} />
        ) : null}
      </View>
    </View>
  );
}
