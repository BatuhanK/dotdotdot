import type { ChatLocale } from './types'

/** Strings that appear inside the rendered phone screen. */
export interface ChatStrings {
  delivered: string
  read: string
  today: string
  yesterday: string
  imessage: string
  sms: string
  placeholderImessage: string
  placeholderSms: string
  online: string
  typing: string
  /** WhatsApp header subtitle under a contact / group name. */
  waContactInfo: string
  waGroupInfo: string
  /** WhatsApp group header while someone types. */
  waTypingName: string
  /** WhatsApp wording of group events (iMessage uses the sys* strings). */
  waSys: {
    added: string
    addedMe: string
    removed: string
    removedMe: string
    left: string
    leftMe: string
    renamed: string
    renamedMe: string
    photo: string
    photoMe: string
  }
  encryption: string
  photo: string
  sysAdded: string
  sysAddedMe: string
  sysRemoved: string
  sysRemovedMe: string
  sysLeft: string
  sysLeftMe: string
  sysRenamed: string
  sysRenamedMe: string
  sysPhoto: string
  sysPhotoMe: string
  /** Joins the last two names of an unnamed group ("Ayşe & Can"). */
  and: string
  /** "{n} more" for unnamed groups with many people. */
  more: string
}

export const CHAT_STRINGS: Record<ChatLocale, ChatStrings> = {
  en: {
    delivered: 'Delivered',
    read: 'Read',
    today: 'Today',
    yesterday: 'Yesterday',
    imessage: 'iMessage',
    sms: 'Text Message • SMS',
    placeholderImessage: 'iMessage',
    placeholderSms: 'Text Message • SMS',
    online: 'online',
    typing: 'typing…',
    waContactInfo: 'tap here for contact info',
    waGroupInfo: 'tap here for group info',
    waTypingName: '{name} is typing…',
    waSys: {
      added: '{actor} added {target}',
      addedMe: 'You added {target}',
      removed: '{actor} removed {target}',
      removedMe: 'You removed {target}',
      left: '{actor} left',
      leftMe: 'You left',
      renamed: '{actor} changed the group name to “{name}”',
      renamedMe: 'You changed the group name to “{name}”',
      photo: "{actor} changed this group's icon",
      photoMe: "You changed this group's icon",
    },
    encryption: 'Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them. Learn more',
    photo: 'Photo',
    sysAdded: '{actor} added {target} to the conversation',
    sysAddedMe: 'You added {target} to the conversation',
    sysRemoved: '{actor} removed {target} from the conversation',
    sysRemovedMe: 'You removed {target} from the conversation',
    sysLeft: '{actor} left the conversation',
    sysLeftMe: 'You left the conversation',
    sysRenamed: '{actor} named the conversation “{name}”',
    sysRenamedMe: 'You named the conversation “{name}”',
    sysPhoto: '{actor} changed the group photo',
    sysPhotoMe: 'You changed the group photo',
    and: '&',
    more: '{n} more',
  },
  tr: {
    delivered: 'Teslim Edildi',
    read: 'Okundu',
    today: 'Bugün',
    yesterday: 'Dün',
    imessage: 'iMessage',
    sms: 'Kısa Mesaj • SMS',
    placeholderImessage: 'iMessage',
    placeholderSms: 'Kısa Mesaj • SMS',
    online: 'çevrimiçi',
    typing: 'yazıyor…',
    waContactInfo: 'kişi bilgisi için buraya dokunun',
    waGroupInfo: 'grup bilgisi için buraya dokunun',
    waTypingName: '{name} yazıyor…',
    waSys: {
      added: '{actor}, {target} kişisini ekledi',
      addedMe: '{target} kişisini eklediniz',
      removed: '{actor}, {target} kişisini çıkardı',
      removedMe: '{target} kişisini çıkardınız',
      left: '{actor} ayrıldı',
      leftMe: 'Ayrıldınız',
      renamed: '{actor} grup adını “{name}” olarak değiştirdi',
      renamedMe: 'Grup adını “{name}” olarak değiştirdiniz',
      photo: '{actor} bu grubun simgesini değiştirdi',
      photoMe: 'Bu grubun simgesini değiştirdiniz',
    },
    encryption:
      'Mesajlar ve aramalar uçtan uca şifrelidir. Bu sohbetin dışındaki hiç kimse, WhatsApp bile bunları okuyamaz ve dinleyemez. Daha fazla bilgi edinin',
    photo: 'Fotoğraf',
    sysAdded: '{actor}, {target} adlı kişiyi sohbete ekledi',
    sysAddedMe: '{target} adlı kişiyi sohbete ekledin',
    sysRemoved: '{actor}, {target} adlı kişiyi sohbetten çıkardı',
    sysRemovedMe: '{target} adlı kişiyi sohbetten çıkardın',
    sysLeft: '{actor} sohbetten ayrıldı',
    sysLeftMe: 'Sohbetten ayrıldın',
    sysRenamed: '{actor} sohbetin adını “{name}” olarak değiştirdi',
    sysRenamedMe: 'Sohbetin adını “{name}” olarak değiştirdin',
    sysPhoto: '{actor} grup fotoğrafını değiştirdi',
    sysPhotoMe: 'Grup fotoğrafını değiştirdin',
    and: 've',
    more: '{n} kişi daha',
  },
  es: {
    delivered: 'Entregado',
    read: 'Leído',
    today: 'Hoy',
    yesterday: 'Ayer',
    imessage: 'iMessage',
    sms: 'Mensaje de texto • SMS',
    placeholderImessage: 'iMessage',
    placeholderSms: 'Mensaje de texto • SMS',
    online: 'en línea',
    typing: 'escribiendo…',
    waContactInfo: 'toca aquí para ver la info. del contacto',
    waGroupInfo: 'toca aquí para ver la info. del grupo',
    waTypingName: '{name} está escribiendo…',
    waSys: {
      added: '{actor} añadió a {target}',
      addedMe: 'Añadiste a {target}',
      removed: '{actor} eliminó a {target}',
      removedMe: 'Eliminaste a {target}',
      left: '{actor} salió',
      leftMe: 'Saliste',
      renamed: '{actor} cambió el nombre del grupo a “{name}”',
      renamedMe: 'Cambiaste el nombre del grupo a “{name}”',
      photo: '{actor} cambió el ícono de este grupo',
      photoMe: 'Cambiaste el ícono de este grupo',
    },
    encryption:
      'Los mensajes y las llamadas están cifrados de extremo a extremo. Solo las personas en este chat pueden leerlos, escucharlos o compartirlos. Más información',
    photo: 'Foto',
    sysAdded: '{actor} añadió a {target} a la conversación',
    sysAddedMe: 'Añadiste a {target} a la conversación',
    sysRemoved: '{actor} eliminó a {target} de la conversación',
    sysRemovedMe: 'Eliminaste a {target} de la conversación',
    sysLeft: '{actor} abandonó la conversación',
    sysLeftMe: 'Abandonaste la conversación',
    sysRenamed: '{actor} nombró la conversación “{name}”',
    sysRenamedMe: 'Nombraste la conversación “{name}”',
    sysPhoto: '{actor} cambió la foto del grupo',
    sysPhotoMe: 'Cambiaste la foto del grupo',
    and: 'y',
    more: '{n} más',
  },
  de: {
    delivered: 'Zugestellt',
    read: 'Gelesen',
    today: 'Heute',
    yesterday: 'Gestern',
    imessage: 'iMessage',
    sms: 'Textnachricht • SMS',
    placeholderImessage: 'iMessage',
    placeholderSms: 'Textnachricht • SMS',
    online: 'online',
    typing: 'schreibt…',
    waContactInfo: 'Tippe hier für Kontaktinfo',
    waGroupInfo: 'Tippe hier für Gruppeninfo',
    waTypingName: '{name} schreibt…',
    waSys: {
      added: '{actor} hat {target} hinzugefügt',
      addedMe: 'Du hast {target} hinzugefügt',
      removed: '{actor} hat {target} entfernt',
      removedMe: 'Du hast {target} entfernt',
      left: '{actor} hat die Gruppe verlassen',
      leftMe: 'Du hast die Gruppe verlassen',
      renamed: '{actor} hat den Gruppennamen zu „{name}“ geändert',
      renamedMe: 'Du hast den Gruppennamen zu „{name}“ geändert',
      photo: '{actor} hat das Gruppenbild geändert',
      photoMe: 'Du hast das Gruppenbild geändert',
    },
    encryption: 'Nachrichten und Anrufe sind Ende-zu-Ende-verschlüsselt. Nur Personen in diesem Chat können sie lesen, anhören oder teilen. Mehr erfahren',
    photo: 'Foto',
    sysAdded: '{actor} hat {target} zur Konversation hinzugefügt',
    sysAddedMe: 'Du hast {target} zur Konversation hinzugefügt',
    sysRemoved: '{actor} hat {target} aus der Konversation entfernt',
    sysRemovedMe: 'Du hast {target} aus der Konversation entfernt',
    sysLeft: '{actor} hat die Konversation verlassen',
    sysLeftMe: 'Du hast die Konversation verlassen',
    sysRenamed: '{actor} hat die Konversation „{name}“ genannt',
    sysRenamedMe: 'Du hast die Konversation „{name}“ genannt',
    sysPhoto: '{actor} hat das Gruppenfoto geändert',
    sysPhotoMe: 'Du hast das Gruppenfoto geändert',
    and: 'und',
    more: '{n} weitere',
  },
  fr: {
    delivered: 'Distribué',
    read: 'Lu',
    today: 'Aujourd’hui',
    yesterday: 'Hier',
    imessage: 'iMessage',
    sms: 'SMS',
    placeholderImessage: 'iMessage',
    placeholderSms: 'SMS',
    online: 'en ligne',
    typing: 'écrit…',
    waContactInfo: 'appuyez ici pour les infos du contact',
    waGroupInfo: 'appuyez ici pour les infos du groupe',
    waTypingName: '{name} écrit…',
    waSys: {
      added: '{actor} a ajouté {target}',
      addedMe: 'Vous avez ajouté {target}',
      removed: '{actor} a retiré {target}',
      removedMe: 'Vous avez retiré {target}',
      left: '{actor} est parti(e)',
      leftMe: 'Vous êtes parti(e)',
      renamed: '{actor} a changé le nom du groupe en « {name} »',
      renamedMe: 'Vous avez changé le nom du groupe en « {name} »',
      photo: '{actor} a changé l’icône de ce groupe',
      photoMe: 'Vous avez changé l’icône de ce groupe',
    },
    encryption:
      'Les messages et les appels sont chiffrés de bout en bout. Seules les personnes de cette discussion peuvent les lire, les écouter ou les partager. En savoir plus',
    photo: 'Photo',
    sysAdded: '{actor} a ajouté {target} à la conversation',
    sysAddedMe: 'Vous avez ajouté {target} à la conversation',
    sysRemoved: '{actor} a retiré {target} de la conversation',
    sysRemovedMe: 'Vous avez retiré {target} de la conversation',
    sysLeft: '{actor} a quitté la conversation',
    sysLeftMe: 'Vous avez quitté la conversation',
    sysRenamed: '{actor} a nommé la conversation « {name} »',
    sysRenamedMe: 'Vous avez nommé la conversation « {name} »',
    sysPhoto: '{actor} a modifié la photo du groupe',
    sysPhotoMe: 'Vous avez modifié la photo du groupe',
    and: 'et',
    more: '{n} autres',
  },
  pt: {
    delivered: 'Entregue',
    read: 'Lida',
    today: 'Hoje',
    yesterday: 'Ontem',
    imessage: 'iMessage',
    sms: 'Mensagem de texto • SMS',
    placeholderImessage: 'iMessage',
    placeholderSms: 'Mensagem de texto • SMS',
    online: 'online',
    typing: 'digitando…',
    waContactInfo: 'toque aqui para dados do contato',
    waGroupInfo: 'toque aqui para dados do grupo',
    waTypingName: '{name} está digitando…',
    waSys: {
      added: '{actor} adicionou {target}',
      addedMe: 'Você adicionou {target}',
      removed: '{actor} removeu {target}',
      removedMe: 'Você removeu {target}',
      left: '{actor} saiu',
      leftMe: 'Você saiu',
      renamed: '{actor} mudou o nome do grupo para “{name}”',
      renamedMe: 'Você mudou o nome do grupo para “{name}”',
      photo: '{actor} mudou a imagem deste grupo',
      photoMe: 'Você mudou a imagem deste grupo',
    },
    encryption:
      'As mensagens e ligações são protegidas com a criptografia de ponta a ponta. Somente as pessoas nesta conversa podem ler, ouvir ou compartilhar. Saiba mais',
    photo: 'Foto',
    sysAdded: '{actor} adicionou {target} à conversa',
    sysAddedMe: 'Você adicionou {target} à conversa',
    sysRemoved: '{actor} removeu {target} da conversa',
    sysRemovedMe: 'Você removeu {target} da conversa',
    sysLeft: '{actor} saiu da conversa',
    sysLeftMe: 'Você saiu da conversa',
    sysRenamed: '{actor} nomeou a conversa “{name}”',
    sysRenamedMe: 'Você nomeou a conversa “{name}”',
    sysPhoto: '{actor} alterou a foto do grupo',
    sysPhotoMe: 'Você alterou a foto do grupo',
    and: 'e',
    more: 'mais {n}',
  },
}

export const LOCALE_LABELS: Record<ChatLocale, string> = {
  en: 'English',
  tr: 'Türkçe',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  pt: 'Português',
}

export { formatClock } from './datetime'

/** Add minutes to a "HH:MM" clock. */
export function addMinutes(clock: string, minutes: number): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(clock.trim())
  if (!m) return clock
  let total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + minutes
  total = ((total % 1440) + 1440) % 1440
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
