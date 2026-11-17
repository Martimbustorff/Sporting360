import { Link } from 'expo-router';
import { Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>S360</Text>
      {__DEV__ ? <Link href="/dev/galeria">Galeria</Link> : null}
    </View>
  );
}
