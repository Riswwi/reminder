import { NextResponse } from 'next/server';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

export async function POST(req) {
  try {
    const db = getFirestore();
    const messaging = getMessaging();

    // Получаем все FCM токены из базы
    const tokensSnapshot = await db.collection('fcm_tokens').get();
    
    if (tokensSnapshot.empty) {
      return NextResponse.json({ success: true, message: 'No tokens found' });
    }

    const tokens = [];
    tokensSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.token) {
        tokens.push(data.token);
      }
    });

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, message: 'No valid tokens found' });
    }

    // Отправляем скрытое data-уведомление (silent push)
    const message = {
      data: {
        action: 'sync_tasks',
        timestamp: String(Date.now())
      },
      android: {
        priority: 'high'
      },
      tokens: tokens
    };

    const response = await messaging.sendEachForMulticast(message);
    
    // Удаляем невалидные токены (если приложение было удалено)
    const tokensToRemove = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const error = resp.error;
        if (error?.code === 'messaging/invalid-registration-token' ||
            error?.code === 'messaging/registration-token-not-registered') {
          tokensToRemove.push(tokens[idx]);
        }
      }
    });

    if (tokensToRemove.length > 0) {
      const batch = db.batch();
      tokensSnapshot.forEach(doc => {
        if (tokensToRemove.includes(doc.data().token)) {
          batch.delete(doc.ref);
        }
      });
      await batch.commit();
    }

    return NextResponse.json({ 
      success: true, 
      successCount: response.successCount, 
      failureCount: response.failureCount 
    });

  } catch (error) {
    console.error('Error sending ping:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
