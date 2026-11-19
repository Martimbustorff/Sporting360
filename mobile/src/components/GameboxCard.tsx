// Figma V7.1: folha GameBox aberta 4951:8673 (QR 189 em cartão branco com raio 16 e padding 12, nome "Strong 14", número
// "Caption 12" a text-muted, blocos Estádio/Pavilhão surface-06 com raio 16, etiquetas Eyebrow 13 primary-on-dark e quatro
// colunas Porta/Sector/Fila/Lugar: Badge 11 a text-subtle sobre Title S 20). O QR toca para o modo bilhete.
// O QR é gerado a partir do número (react-native-qrcode-svg), não a imagem do nó.
// SEM FIGMA: número ilegível (sem QR, com explicação).
// Task 24: o número decifrado só se mostra no ecrã; nunca vai para logs. Plano 9 (frames 43 e 44): mostra-se em grupos de
// quatro (formatGameboxNumber, só para ver); o QR e a validação usam sempre os algarismos sem espaços.
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Touchable } from '@/components/Touchable';
import { formatGameboxNumber, gameboxLabel, normalizeGameboxNumber, VENUE_NAMES, type GameboxView, type Seat } from '@/lib/gamebox';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

export const CARD_TEXT = {
  stadium: 'Estádio',
  pavilion: 'Pavilhão',
  unreadable: 'Não foi possível ler o número desta GameBox. Corrige-o em Gestão de GameBox.',
  ticketHint: 'Toca no código para o modo bilhete',
} as const;

const SEAT_COLUMNS: { key: keyof Seat; label: string }[] = [
  { key: 'port', label: 'Porta' },
  { key: 'sector', label: 'Sector' },
  { key: 'line', label: 'Fila' },
  { key: 'seat', label: 'Lugar' },
];

function Column({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: layout.gameboxTextGap }}>
      <Text71 variant="badge11" color="textSubtle" numberOfLines={1}>{label}</Text71>
      <Text71 variant="titleS20" numberOfLines={1}>{value || ' '}</Text71>
    </View>
  );
}

function SeatBlock({ venue, venueName, seat }: { venue: string; venueName: string; seat: Seat }) {
  return (
    <View
      accessible
      accessibilityLabel={`${venue} ${venueName}: ${SEAT_COLUMNS.map((c) => `${c.label} ${seat[c.key] || '-'}`).join(', ')}`}
      style={{
        backgroundColor: colors.surface06,
        borderRadius: radii.r16,
        paddingHorizontal: space.s16,
        paddingVertical: space.s12,
        gap: space.s8,
        alignSelf: 'stretch',
      }}
    >
      <Text71 variant="eyebrow13" color="primaryOnDark" numberOfLines={1}>{venue}</Text71>
      <View style={{ flexDirection: 'row' }}>
        {SEAT_COLUMNS.map((c) => (
          <Column key={c.key} label={c.label} value={seat[c.key]} />
        ))}
      </View>
    </View>
  );
}

export function GameboxCard({
  gamebox,
  index = 0,
  onOpenTicket,
}: {
  gamebox: GameboxView;
  index?: number;
  /** Toque no QR: abre o modo bilhete desta GameBox. */
  onOpenTicket?: (gamebox: GameboxView) => void;
}) {
  const number = normalizeGameboxNumber(gamebox.number);
  const name = gameboxLabel(gamebox.name, index);
  return (
    <View style={{ alignItems: 'center', gap: layout.gameboxOpenGap }}>
      {number ? (
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`Código QR da GameBox ${name}`}
          accessibilityHint="Abre o modo bilhete"
          disabled={!onOpenTicket}
          onPress={() => onOpenTicket?.(gamebox)}
          style={{ backgroundColor: colors.white, borderRadius: radii.r16, padding: layout.gameboxQrPad }}
        >
          <QRCode value={number} size={layout.gameboxQr} color={colors.ink} backgroundColor={colors.white} quietZone={0} />
        </Touchable>
      ) : null}
      <View style={{ alignItems: 'center', gap: layout.gameboxTextGap }}>
        <Text71 variant="strong14" numberOfLines={1}>{name}</Text71>
        {number ? (
          <Text71 variant="caption12" color="textMuted" accessibilityLabel={number}>{formatGameboxNumber(number)}</Text71>
        ) : (
          <Text71 variant="caption12" color="textMuted" style={{ textAlign: 'center' }}>{CARD_TEXT.unreadable}</Text71>
        )}
      </View>
      <View style={{ alignSelf: 'stretch', gap: layout.gameboxOpenGap }}>
        <SeatBlock venue={CARD_TEXT.stadium} venueName={VENUE_NAMES.stadium} seat={gamebox.stadium} />
        {gamebox.pavilion ? (
          <SeatBlock venue={CARD_TEXT.pavilion} venueName={VENUE_NAMES.pavilion} seat={gamebox.pavilion} />
        ) : null}
      </View>
    </View>
  );
}
