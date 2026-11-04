import type { PagesContent } from './types'

export const fr: PagesContent = {
  about: {
    eyebrow: 'À propos',
    title: 'La Mauritanie, vue par les siens.',
    lead: 'SOURA — صورة, « image » — est une galerie de photographies de Mauritanie, prises par celles et ceux qui y vivent ou qui en viennent.',
    sections: [
      {
        id: 'pourquoi',
        title: 'Pourquoi SOURA',
        paragraphs: [
          'Les images du pays qui circulent le plus sont souvent prises de passage. Pourtant, des photographes mauritaniens documentent chaque jour leurs villes, leurs paysages, leurs fêtes et leur quotidien — avec un regard que personne d’autre n’a.',
          'SOURA rassemble ce travail en un seul lieu, le met en valeur comme dans un magazine, et permet à qui veut utiliser une image — média, agence, institution, entreprise — de contacter directement son auteur.',
        ],
      },
      {
        id: 'comment',
        title: 'Comment ça fonctionne',
        list: [
          'Les photographes créent un profil gratuit et proposent leurs images.',
          'Chaque photo est vérifiée par notre équipe avant d’être publiée : qualité, lien avec la Mauritanie, respect des personnes et des règles de contenu.',
          'Les visiteurs parcourent la galerie par région, sujet ou photographe.',
          'Pour utiliser une photo, on écrit directement à son auteur, par WhatsApp ou par e-mail. Conditions et prix se décident entre vous.',
        ],
      },
      {
        id: 'droits',
        title: 'Les droits restent aux auteurs',
        paragraphs: [
          'Les originaux ne sont jamais téléchargeables. Le site ne montre que des aperçus générés par nos serveurs, débarrassés de leurs métadonnées (dont la position GPS), limités en taille et marqués du nom de l’auteur.',
          'SOURA ne vend pas d’images, ne prend pas de commission et n’intervient pas dans les accords entre photographes et utilisateurs.',
        ],
      },
      {
        id: 'confiance',
        title: 'Confiance et sécurité',
        paragraphs: [
          'Rien n’est publié sans décision humaine. Une analyse automatique peut aider l’équipe à repérer certains contenus, mais elle ne valide jamais une photo. Chaque image publique peut être signalée, et les signalements répétés la masquent automatiquement en attendant notre examen.',
          'Le site n’utilise ni cookies publicitaires ni traceurs. Les statistiques de vues sont comptées de façon anonyme.',
        ],
      },
      {
        id: 'gratuit',
        title: 'Gratuit, pour l’instant',
        paragraphs: [
          'SOURA est gratuit pour les photographes comme pour les visiteurs. Des options payantes pourront être proposées plus tard aux photographes qui le souhaitent ; la galerie de base restera ouverte.',
        ],
      },
    ],
  },
  forPhotographers: {
    eyebrow: 'Pour les photographes',
    title: 'Montrez la Mauritanie telle que vous la voyez.',
    lead: 'Un profil gratuit, une vérification attentive de chaque image, et les demandes d’utilisation qui arrivent directement chez vous.',
    sections: [
      {
        id: 'etapes',
        title: 'En quatre étapes',
        list: [
          'Créez votre compte et confirmez votre adresse e-mail.',
          'Complétez votre profil : présentation, région, et les moyens de contact que vous souhaitez afficher (WhatsApp, e-mail, ou les deux).',
          'Publiez vos photos : titre, région ou lieu, catégorie, année. Comptez quelques jours de vérification.',
          'Suivez dans votre espace le statut de chaque photo, le motif en cas de refus, ainsi que les vues et les demandes de contact.',
        ],
      },
      {
        id: 'ce-que-nous-cherchons',
        title: 'Ce que nous recherchons',
        list: [
          'Des images nettes, bien exposées, avec un vrai lien avec la Mauritanie.',
          'Des photographies que vous avez prises vous-même, ou dont vous détenez les droits.',
          'Le respect des personnes photographiées : leur accord, et celui d’un parent pour un mineur.',
          'Pas de captures d’écran, de filtres trop marqués ou de grands filigranes : nous ajoutons nous-mêmes votre crédit.',
        ],
      },
      {
        id: 'vos-droits',
        title: 'Vos droits et vos fichiers',
        paragraphs: [
          'Vous restez propriétaire de vos images. En les publiant, vous autorisez seulement SOURA à afficher des aperçus réduits et filigranés pour présenter votre travail.',
          'Votre fichier original reste privé : il n’est jamais proposé au téléchargement et seuls vous et l’équipe de modération pouvez y accéder, par des liens temporaires. Les métadonnées (appareil, position GPS) sont retirées de toutes les images publiques.',
          'Vous pouvez supprimer une photo à tout moment depuis votre espace.',
        ],
      },
      {
        id: 'contact',
        title: 'Vos coordonnées',
        paragraphs: [
          'Votre numéro WhatsApp et votre adresse e-mail n’apparaissent jamais dans le code des pages. Ils ne s’affichent qu’après un clic du visiteur, via un service protégé contre les envois automatiques.',
        ],
      },
    ],
  },
  contentRules: {
    eyebrow: 'Règles de contenu',
    title: 'Ce qui a sa place sur SOURA',
    lead: 'Ces règles protègent les personnes photographiées, les auteurs et les visiteurs. Toute photo qui ne les respecte pas est refusée ou retirée.',
    sections: [
      {
        id: 'interdit',
        title: 'Contenus interdits',
        list: [
          'Nudité et contenu sexuel, quels qu’ils soient.',
          'Toute image sexualisant un mineur. Ces contenus sont signalés aux autorités et le compte est suspendu.',
          'Violence explicite, blessures ou cadavres exposés.',
          'Contenus haineux, ou qui ridiculisent une personne ou un groupe pour son origine, sa religion, son genre, son handicap ou son statut social.',
          'Images humiliantes ou dégradantes d’une personne, y compris de personnes en situation de vulnérabilité.',
          'Photos volées : images dont vous n’êtes pas l’auteur et pour lesquelles vous n’avez pas d’autorisation.',
        ],
      },
      {
        id: 'personnes',
        title: 'Les personnes photographiées',
        list: [
          'Les personnes identifiables doivent avoir accepté d’être photographiées et publiées.',
          'Pour un mineur, l’accord d’un parent ou d’un tuteur est nécessaire. Ces photos font l’objet d’une vérification renforcée.',
          'Une personne qui se reconnaît et n’a pas consenti peut demander le retrait de la photo.',
        ],
      },
      {
        id: 'qualite',
        title: 'Qualité',
        list: [
          'Images nettes et correctement exposées.',
          'Un lien clair avec la Mauritanie : lieu, personnes, culture, vie quotidienne.',
          'Pas de captures d’écran ni d’images reprises d’un autre support.',
          'Pas de filtres ou de retouches qui dénaturent l’image.',
          'Pas de grand filigrane, de logo ou de texte incrusté.',
        ],
      },
      {
        id: 'moderation',
        title: 'Comment nous modérons',
        paragraphs: [
          'Chaque photo est examinée par une personne de l’équipe avant publication. Une analyse automatique peut signaler certains risques, mais la décision est toujours humaine. En cas de refus, le motif est indiqué dans votre espace et le fichier est supprimé de nos serveurs après une courte période.',
          'Toute photo publique peut être signalée. Plusieurs signalements indépendants la masquent automatiquement en attendant notre examen ; un signalement d’abus sur mineur la masque immédiatement.',
        ],
      },
    ],
  },
  terms: {
    eyebrow: 'Conditions d’utilisation',
    title: 'Conditions d’utilisation',
    lead: 'Ces conditions encadrent l’utilisation de SOURA par les visiteurs et les photographes.',
    draft: true,
    updated: '2026-11-04',
    sections: [
      { id: 'objet', title: '1. Objet', paragraphs: ['SOURA est un service gratuit de présentation de photographies de Mauritanie. Il permet aux photographes de publier des aperçus de leurs images et aux visiteurs de les contacter. SOURA n’est pas partie aux accords conclus entre photographes et utilisateurs d’images.'] },
      { id: 'compte', title: '2. Compte photographe', paragraphs: ['L’inscription demande une adresse e-mail valide et confirmée. Vous êtes responsable de la confidentialité de votre mot de passe et des contenus publiés depuis votre compte. Un compte peut être suspendu en cas de violation de ces conditions ou des règles de contenu.'] },
      { id: 'contenus', title: '3. Vos contenus', paragraphs: ['Vous déclarez être l’auteur des photos publiées ou détenir les droits nécessaires, et avoir obtenu l’accord des personnes identifiables (et, pour un mineur, de son représentant légal).', 'Vous conservez l’intégralité de vos droits. Vous accordez à SOURA, pour la durée de publication, une autorisation non exclusive et gratuite d’héberger vos fichiers et d’afficher des aperçus réduits et filigranés, y compris dans les aperçus de partage sur les réseaux sociaux, aux seules fins de présenter votre travail.'] },
      { id: 'moderation', title: '4. Modération', paragraphs: ['Toute photo est vérifiée avant publication et peut être refusée, masquée ou retirée, notamment en cas de non-respect des règles de contenu ou de signalement. Les fichiers refusés sont supprimés après une période de conservation courte, sauf obligation légale de conservation.'] },
      { id: 'visiteurs', title: '5. Utilisation par les visiteurs', paragraphs: ['Les images affichées ne sont pas libres de droits. Toute reproduction, diffusion ou utilisation commerciale nécessite l’accord préalable de l’auteur. Il est interdit de contourner les protections du site ou de collecter automatiquement les coordonnées des photographes.'] },
      { id: 'responsabilite', title: '6. Responsabilité', paragraphs: ['SOURA s’efforce d’assurer la disponibilité du service sans garantie de continuité. SOURA n’est pas responsable des échanges, accords ou litiges entre photographes et utilisateurs.'] },
      { id: 'signalement', title: '7. Signalement et retrait', paragraphs: ['Toute personne peut signaler une photo ou demander son retrait via le bouton « Signaler » ou le formulaire de retrait. Les demandes sont traitées dans les meilleurs délais.'] },
      { id: 'modification', title: '8. Modifications', paragraphs: ['Ces conditions peuvent évoluer, notamment si des services payants sont proposés. Les photographes seront informés des changements importants.'] },
      { id: 'droit', title: '9. Droit applicable', paragraphs: ['[À compléter par un juriste : droit applicable, juridiction compétente et identité de l’éditeur du site.]'] },
    ],
  },
  privacy: {
    eyebrow: 'Confidentialité',
    title: 'Politique de confidentialité',
    lead: 'Nous collectons le moins de données possible, et seulement pour faire fonctionner le service.',
    draft: true,
    updated: '2026-11-04',
    sections: [
      { id: 'responsable', title: 'Responsable du traitement', paragraphs: ['[À compléter : nom et coordonnées de l’éditeur du site et, le cas échéant, du délégué à la protection des données.]'] },
      { id: 'donnees', title: 'Données collectées', list: ['Compte : adresse e-mail, mot de passe (stocké uniquement sous forme chiffrée irréversible), langue.', 'Profil : nom affiché, présentation, région, ville, liens, et les coordonnées de contact que vous choisissez d’afficher.', 'Photos : les fichiers envoyés et leurs informations. Les métadonnées (dont la position GPS) sont retirées de toutes les images publiques ; l’original reste privé.', 'Signalements : le motif et le message ; pour le formulaire de retrait, votre nom et votre e-mail.', 'Technique : l’adresse IP est utilisée de façon temporaire pour limiter les abus (envois, connexions, affichage des coordonnées).'] },
      { id: 'mesure', title: 'Mesure d’audience', paragraphs: ['SOURA n’utilise ni cookies publicitaires ni traceurs. Les vues et les demandes de contact sont comptées à l’aide d’une empreinte anonyme calculée avec une valeur aléatoire renouvelée chaque jour et supprimée après deux jours : il n’est pas possible de suivre un visiteur d’un jour à l’autre.', 'Un seul cookie est utilisé, uniquement pour les photographes connectés, afin de maintenir leur session. Le thème clair ou sombre est mémorisé dans votre navigateur, sans cookie.'] },
      { id: 'finalites', title: 'Finalités', list: ['Fournir le service : comptes, publication, modération, affichage des profils.', 'Sécurité : prévenir les abus, le spam et les contenus illégaux.', 'Statistiques fournies aux photographes sur leurs propres photos.'] },
      { id: 'sous-traitants', title: 'Prestataires', paragraphs: ['Le service s’appuie sur un hébergeur, un service de stockage de fichiers et un service d’envoi d’e-mails. Si l’analyse automatique de sécurité est activée, une version réduite et sans métadonnées de chaque photo envoyée est transmise à un prestataire d’analyse pour détecter des contenus interdits. [À compléter : noms, pays et garanties des prestataires.]'] },
      { id: 'conservation', title: 'Durées de conservation', list: ['Photos refusées ou retirées : supprimées après une courte période (7 jours par défaut).', 'Comptes : jusqu’à leur suppression.', 'Journal de modération : conservé pour assurer la traçabilité des décisions. [Durée à fixer avec un juriste.]', 'Contenus soumis à une obligation légale de conservation : conservés selon cette obligation.'] },
      { id: 'droits', title: 'Vos droits', paragraphs: ['Vous pouvez accéder à vos données, les rectifier ou les supprimer, et supprimer vos photos à tout moment depuis votre espace. Pour toute demande : [adresse de contact à compléter].'] },
    ],
  },
  report: {
    eyebrow: 'Signaler / retrait',
    title: 'Signaler une photo ou demander son retrait',
    lead: 'Vous êtes l’auteur d’une image publiée sans votre accord, une personne photographiée sans consentement, ou vous avez repéré un contenu interdit ? Écrivez-nous ici.',
    draft: true,
    updated: '2026-11-04',
    sections: [
      { id: 'delais', title: 'Comment nous traitons les demandes', list: ['Chaque demande est lue par une personne de l’équipe.', 'Les contenus manifestement illégaux sont masqués sans attendre la fin de l’examen.', 'Nous pouvons vous demander des éléments complémentaires, par exemple pour établir que vous êtes l’auteur d’une image.', 'Le photographe concerné peut être informé de la demande, sans communication de vos coordonnées, sauf cas d’abus sur mineur.'] },
    ],
  },
}
